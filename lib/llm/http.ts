import * as http from 'node:http'
import * as https from 'node:https'
import { createPinnedLookup } from '@/lib/net/pinned-lookup'
import { assertSafeRemoteUrl } from '@/lib/recipe/ssrf'

export type LlmJsonRequestOptions = {
  apiKey: string
  allowPrivateNetwork: boolean
  maxResponseBytes: number
  timeoutMs: number
  method?: 'GET' | 'POST'
  body?: string
}

export function assertLlmEndpointUrl(
  input: string | URL,
  allowPrivateNetwork: boolean,
): URL {
  let url: URL
  try {
    url = input instanceof URL ? new URL(input) : new URL(input)
  } catch {
    throw new Error('LLM_UNSAFE_ENDPOINT')
  }

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('LLM_UNSAFE_ENDPOINT')
  }
  if (!allowPrivateNetwork) {
    if (url.protocol !== 'https:') throw new Error('LLM_UNSAFE_ENDPOINT')
    try {
      return assertSafeRemoteUrl(url)
    } catch {
      throw new Error('LLM_UNSAFE_ENDPOINT')
    }
  }
  return url
}

function isJsonContentType(value: string | string[] | undefined): boolean {
  const contentType = String(Array.isArray(value) ? value[0] : value ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase()
  return (
    contentType === 'application/json' ||
    /^application\/[a-z0-9.+-]+\+json$/.test(contentType)
  )
}

export async function requestLlmJson(
  input: URL,
  options: LlmJsonRequestOptions,
): Promise<unknown> {
  const endpoint = assertLlmEndpointUrl(input, options.allowPrivateNetwork)
  const lookup = await createPinnedLookup(endpoint, {
    allowPrivateNetwork: options.allowPrivateNetwork,
  })
  const transport = endpoint.protocol === 'https:' ? https : http
  const method = options.method ?? 'GET'
  const body = options.body ?? ''
  const headers: Record<string, string | number> = {
    Accept: 'application/json',
  }
  if (options.apiKey) headers.Authorization = `Bearer ${options.apiKey}`
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = Buffer.byteLength(body)
  }

  const raw = await new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (error?: Error, result?: string) => {
      if (settled) return
      settled = true
      clearTimeout(totalTimer)
      if (error) reject(error)
      else resolve(result ?? '')
    }
    const request = transport.request(
      endpoint,
      {
        method,
        agent: false,
        lookup,
        headers,
      },
      (response) => {
        const status = response.statusCode ?? 0
        if (
          status < 200 ||
          status >= 300 ||
          !isJsonContentType(response.headers['content-type'])
        ) {
          response.resume()
          return finish(new Error('LLM_REQUEST_FAILED'))
        }

        const declaredLength = Number(response.headers['content-length'])
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > options.maxResponseBytes
        ) {
          response.resume()
          return finish(new Error('LLM_RESPONSE_TOO_LARGE'))
        }

        const chunks: Buffer[] = []
        let size = 0
        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > options.maxResponseBytes) {
            response.destroy(new Error('LLM_RESPONSE_TOO_LARGE'))
            return
          }
          chunks.push(chunk)
        })
        response.on('end', () =>
          finish(undefined, Buffer.concat(chunks, size).toString('utf8')),
        )
        response.on('error', (error) => finish(error))
      },
    )
    request.on('error', (error) => finish(error))
    request.setTimeout(options.timeoutMs, () =>
      request.destroy(new Error('LLM_TIMEOUT')),
    )
    const totalTimer = setTimeout(
      () => request.destroy(new Error('LLM_TIMEOUT')),
      options.timeoutMs,
    )
    request.end(method === 'POST' ? body : undefined)
  })

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('LLM_RESPONSE_INVALID')
  }
}
