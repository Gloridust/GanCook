import type { RecipeDraft } from './parse'
import {
  capHtml,
  codePointOrEntity,
  findElements,
  firstElementInner,
} from './html-scan'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code[0] === '#') {
        const hex = code[1]?.toLowerCase() === 'x'
        const parsed = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
        return codePointOrEntity(parsed, entity)
      }
      return named[code.toLowerCase()] ?? entity
    },
  )
}

function cleanText(value: unknown, max = 50_000): string {
  if (typeof value !== 'string') return ''
  return decodeHtml(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max)
}

function cleanTitle(value: unknown): string {
  return cleanText(value, 100)
    .replace(/\s*[-_｜|]\s*小红书(?:\s*.*)?$/u, '')
    .trim()
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(
    /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g,
  )) {
    attributes[match[1].toLowerCase()] = decodeHtml(
      match[2] ?? match[3] ?? match[4] ?? '',
    )
  }
  return attributes
}

function metadata(html: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const match of html.matchAll(/<meta\b[^<>]*>/gi)) {
    const attrs = parseAttributes(match[0])
    const key = (attrs.property || attrs.name || '').toLowerCase()
    if (key && attrs.content && !result.has(key)) {
      result.set(key, attrs.content)
    }
  }
  return result
}

function replaceUndefined(value: string): string {
  let output = ''
  let quote = ''
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      output += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      output += char
      continue
    }
    if (
      value.startsWith('undefined', index) &&
      !/[\w$]/.test(value[index - 1] ?? '') &&
      !/[\w$]/.test(value[index + 9] ?? '')
    ) {
      output += 'null'
      index += 8
      continue
    }
    output += char
  }
  return output
}

function balancedJson(value: string, start: number): string | null {
  const opening = value[start]
  const closing = opening === '{' ? '}' : opening === '[' ? ']' : ''
  if (!closing) return null

  let depth = 0
  let quote = ''
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === opening) depth += 1
    if (char === closing) depth -= 1
    if (depth === 0) return value.slice(start, index + 1)
  }
  return null
}

function quotedLiteral(value: string, start: number): string | null {
  if (value[start] !== '"') return null
  let escaped = false
  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index]
    if (escaped) escaped = false
    else if (char === '\\') escaped = true
    else if (char === '"') return value.slice(start, index + 1)
  }
  return null
}

function parseInitialState(script: string): unknown {
  const decoded = decodeHtml(script)
  const marker = decoded.indexOf('__INITIAL_STATE__')
  if (marker < 0) return null
  const equals = decoded.indexOf('=', marker)
  if (equals < 0) return null
  const expression = decoded.slice(equals + 1).trimStart()

  try {
    if (expression.startsWith('JSON.parse')) {
      const open = expression.indexOf('(')
      const start = expression.slice(open + 1).search(/\S/) + open + 1
      const literal = quotedLiteral(expression, start)
      if (!literal) return null
      const inner = JSON.parse(literal)
      return typeof inner === 'string'
        ? JSON.parse(replaceUndefined(inner))
        : inner
    }

    const start = expression.search(/[\[{]/)
    if (start < 0) return null
    const json = balancedJson(expression, start)
    return json ? JSON.parse(replaceUndefined(json)) : null
  } catch {
    return null
  }
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(decodeHtml(value))
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed.toString()
      : null
  } catch {
    return null
  }
}

function firstImage(value: unknown): string | null {
  const direct = httpUrl(value)
  if (direct) return direct
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstImage(item)
      if (image) return image
    }
    return null
  }
  if (!isObject(value)) return null
  for (const key of [
    'urlDefault',
    'urlPre',
    'url',
    'urlList',
    'imageList',
    'images',
    'cover',
    'image',
  ]) {
    const image = firstImage(value[key])
    if (image) return image
  }
  return null
}

function noteCandidate(value: unknown): {
  title: string
  body: string
  imageUrl: string | null
} | null {
  const stack: unknown[] = [value]
  const seen = new WeakSet<object>()
  let best:
    | { title: string; body: string; imageUrl: string | null; score: number }
    | undefined
  let visited = 0

  while (stack.length && visited < 50_000) {
    const current = stack.pop()
    visited += 1
    if (Array.isArray(current)) {
      stack.push(...current)
      continue
    }
    if (!isObject(current) || seen.has(current)) continue
    seen.add(current)

    const title = cleanTitle(
      current.title ?? current.noteTitle ?? current.displayTitle,
    )
    const body = cleanText(
      current.desc ??
        current.description ??
        current.content ??
        current.noteText ??
        current.text,
    )
    if (title || body) {
      const imageUrl = firstImage(
        current.imageList ??
          current.images ??
          current.cover ??
          current.image,
      )
      const score =
        Number(Boolean(title)) * 3 +
        Number(Boolean(body)) * 5 +
        Number(Boolean(imageUrl)) * 2 +
        Number('imageList' in current)
      if (!best || score > best.score) {
        best = { title, body, imageUrl, score }
      }
    }
    stack.push(...Object.values(current))
  }

  return best
    ? { title: best.title, body: best.body, imageUrl: best.imageUrl }
    : null
}

function isUnavailablePage(title: string, body: string): boolean {
  const text = `${title}\n${body}`
  return (
    /(?:安全验证|滑动验证|访问验证|请登录|登录后继续|captcha|verification|access denied)/i.test(
      text,
    ) ||
    (!body && /^(?:小红书|登录|验证)$/u.test(title))
  )
}

function isXiaohongshuUrl(pageUrl: string): boolean {
  try {
    const hostname = new URL(pageUrl).hostname.toLowerCase()
    return (
      hostname === 'xiaohongshu.com' ||
      hostname.endsWith('.xiaohongshu.com')
    )
  } catch {
    return false
  }
}

export function extractXiaohongshuRecipeFromHtml(
  rawHtml: string,
  pageUrl: string,
): RecipeDraft | null {
  if (!isXiaohongshuUrl(pageUrl)) return null
  const html = capHtml(rawHtml)

  let note:
    | { title: string; body: string; imageUrl: string | null }
    | null = null
  for (const script of findElements(html, 'script')) {
    const state = parseInitialState(script.inner)
    const candidate = noteCandidate(state)
    if (
      candidate &&
      (!note ||
        Number(Boolean(candidate.body)) + Number(Boolean(candidate.imageUrl)) >
          Number(Boolean(note.body)) + Number(Boolean(note.imageUrl)))
    ) {
      note = candidate
    }
  }

  const meta = metadata(html)
  const titleText = firstElementInner(html, 'title')
  const title =
    note?.title ||
    cleanTitle(
      meta.get('og:title') ||
        meta.get('twitter:title') ||
        titleText ||
        '',
    )
  const body =
    note?.body ||
    cleanText(
      meta.get('og:description') ||
        meta.get('twitter:description') ||
        meta.get('description') ||
        '',
    )
  const imageUrl =
    note?.imageUrl ||
    firstImage(meta.get('og:image') || meta.get('twitter:image'))
  if (isUnavailablePage(title, body) || (!body && !imageUrl)) {
    return {
      name: '',
      description: '',
      instructions: '',
      tags: [],
      imageUrl: null,
    }
  }

  return {
    name: title,
    description: body.slice(0, 200),
    instructions: body,
    tags: [],
    imageUrl,
  }
}
