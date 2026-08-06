import 'server-only'
import { lookup } from 'node:dns/promises'
import * as http from 'node:http'
import * as https from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import { assertSafeRemoteUrl, selectPublicAddress } from './ssrf'

export type RemoteResource = {
  body: Buffer
  contentType: string
  finalUrl: string
}

type ResourceKind = 'html' | 'image'

const LIMITS: Record<
  ResourceKind,
  { bytes: number; contentTypes: readonly string[] }
> = {
  html: {
    bytes: 3 * 1024 * 1024,
    contentTypes: [
      'text/html',
      'application/xhtml+xml',
      'application/json',
      'application/ld+json',
    ],
  },
  image: {
    bytes: 5 * 1024 * 1024,
    contentTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/avif',
    ],
  },
}

const REDIRECTS = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5
const REQUEST_TIMEOUT_MS = 10_000

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? ''
}

export async function createPinnedLookup(url: URL): Promise<LookupFunction> {
  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const family = isIP(hostname)
  const addresses = family
    ? [{ address: hostname, family }]
    : await lookup(hostname, { all: true, verbatim: true })
  const selected = selectPublicAddress(addresses)
  return (_hostname, _options, callback) => {
    callback(null, selected.address, selected.family)
  }
}

async function requestOnce(
  url: URL,
  kind: ResourceKind,
): Promise<
  | { redirect: URL }
  | { body: Buffer; contentType: string }
> {
  const lookupFn = await createPinnedLookup(url)
  const transport = url.protocol === 'https:' ? https : http
  const { bytes, contentTypes } = LIMITS[kind]

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (
      error?: Error,
      result?: { redirect: URL } | { body: Buffer; contentType: string },
    ) => {
      if (settled) return
      settled = true
      clearTimeout(totalTimer)
      if (error) reject(error)
      else resolve(result!)
    }

    const request = transport.request(
      url,
      {
        method: 'GET',
        agent: false,
        lookup: lookupFn,
        headers: {
          Accept:
            kind === 'image'
              ? 'image/avif,image/webp,image/png,image/jpeg,image/gif'
              : 'text/html,application/xhtml+xml,application/ld+json,application/json;q=0.9',
          'Accept-Encoding': 'identity',
          'User-Agent': 'GanCook Recipe Importer/1.0',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        if (REDIRECTS.has(status)) {
          const location = headerValue(response.headers.location)
          response.resume()
          if (!location) return finish(new Error('BAD_REDIRECT'))
          try {
            return finish(undefined, { redirect: new URL(location, url) })
          } catch {
            return finish(new Error('BAD_REDIRECT'))
          }
        }
        if (status < 200 || status >= 300) {
          response.resume()
          return finish(new Error('REMOTE_STATUS'))
        }

        const encoding = headerValue(response.headers['content-encoding'])
          .split(';')[0]
          .trim()
          .toLowerCase()
        if (encoding && encoding !== 'identity') {
          response.resume()
          return finish(new Error('UNSUPPORTED_ENCODING'))
        }

        const contentType = headerValue(response.headers['content-type'])
          .split(';')[0]
          .trim()
          .toLowerCase()
        if (!contentTypes.includes(contentType)) {
          response.resume()
          return finish(new Error('UNSUPPORTED_CONTENT_TYPE'))
        }
        const declaredLength = Number(
          headerValue(response.headers['content-length']),
        )
        if (Number.isFinite(declaredLength) && declaredLength > bytes) {
          response.resume()
          return finish(new Error('REMOTE_BODY_TOO_LARGE'))
        }

        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > bytes) {
            response.destroy(new Error('REMOTE_BODY_TOO_LARGE'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () =>
          finish(undefined, {
            body: Buffer.concat(chunks, size),
            contentType,
          }),
        )
        response.on('error', (error) => finish(error))
      },
    )
    request.on('error', (error) => finish(error))
    request.setTimeout(REQUEST_TIMEOUT_MS, () =>
      request.destroy(new Error('REMOTE_TIMEOUT')),
    )
    const totalTimer = setTimeout(
      () => request.destroy(new Error('REMOTE_TIMEOUT')),
      REQUEST_TIMEOUT_MS,
    )
    request.end()
  })
}

export async function safeFetchResource(
  input: string | URL,
  kind: ResourceKind,
): Promise<RemoteResource> {
  let url = assertSafeRemoteUrl(input)
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    const response = await requestOnce(url, kind)
    if ('redirect' in response) {
      if (redirects === MAX_REDIRECTS) throw new Error('TOO_MANY_REDIRECTS')
      url = assertSafeRemoteUrl(response.redirect)
      continue
    }
    return {
      ...response,
      finalUrl: url.toString(),
    }
  }
  throw new Error('TOO_MANY_REDIRECTS')
}
