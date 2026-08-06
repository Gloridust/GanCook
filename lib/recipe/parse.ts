export type RecipeDraft = {
  name: string
  description: string
  instructions: string
  tags: string[]
  imageUrl: string | null
}

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
        const value = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10)
        return Number.isFinite(value) ? String.fromCodePoint(value) : entity
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

function typesOf(value: JsonObject): string[] {
  const type = value['@type']
  return Array.isArray(type)
    ? type.filter((item): item is string => typeof item === 'string')
    : typeof type === 'string'
      ? [type]
      : []
}

function isRecipeType(type: string): boolean {
  const normalized = type.toLowerCase().replace(/[\/#]+$/, '')
  return normalized === 'recipe' || /[\/#]recipe$/.test(normalized)
}

function findRecipes(
  value: unknown,
  found: JsonObject[] = [],
  seen = new WeakSet<object>(),
): JsonObject[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      findRecipes(item, found, seen)
    }
    return found
  }
  if (!isObject(value) || seen.has(value)) return found
  seen.add(value)
  if (typesOf(value).some(isRecipeType)) {
    found.push(value)
  }
  for (const child of Object.values(value)) {
    findRecipes(child, found, seen)
  }
  return found
}

function instructionLines(
  value: unknown,
  sectionName = '',
): string[] {
  if (typeof value === 'string') {
    const text = cleanText(value)
    return text ? [sectionName ? `${sectionName}：${text}` : text] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => instructionLines(item, sectionName))
  }
  if (!isObject(value)) return []

  const ownName = cleanText(value.name, 100)
  const nextSection = ownName || sectionName
  const nested = value.itemListElement ?? value.steps
  if (nested) return instructionLines(nested, nextSection)

  const text = cleanText(value.text ?? value.description)
  return text ? [nextSection ? `${nextSection}：${text}` : text] : []
}

function normalizeInstructions(value: unknown): string {
  if (typeof value === 'string') {
    const text = cleanText(value)
    const matches = [
      ...text.matchAll(
        /(?:^|[,，])\s*\d+\.\s*([\s\S]*?)(?=(?:[,，]\s*\d+\.)|$)/g,
      ),
    ]
    if (matches.length > 1) {
      return matches
        .map((match, index) => `${index + 1}. ${cleanText(match[1])}`)
        .join('\n')
    }
    return text
  }
  const lines = instructionLines(value)
  return lines.map((line, index) => `${index + 1}. ${line}`).join('\n')
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringList(item))
  }
  if (typeof value !== 'string') return []
  return value
    .split(/[,，;；|]/)
    .map((item) => cleanText(item, 40))
    .filter(Boolean)
}

function normalizeTags(recipe: JsonObject): string[] {
  const tags = [
    ...stringList(recipe.keywords),
    ...stringList(recipe.recipeCategory),
    ...stringList(recipe.recipeCuisine),
  ].filter(
    (tag) =>
      !/(?:的做法|怎么做|家常做法|详细做法|最正宗做法)$/u.test(tag),
  )
  return [...new Set(tags)].slice(0, 6)
}

function imageFrom(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = imageFrom(item)
      if (image) return image
    }
  }
  if (isObject(value)) {
    return imageFrom(value.url ?? value.contentUrl)
  }
  return null
}

export function parseRecipeJsonLd(value: unknown): RecipeDraft | null {
  const drafts = findRecipes(value).map((recipe) => ({
    name: cleanText(recipe.name ?? recipe.headline, 100),
    description: cleanText(recipe.description, 2_000),
    instructions: normalizeInstructions(recipe.recipeInstructions),
    tags: normalizeTags(recipe),
    imageUrl: imageFrom(recipe.image),
  }))
  return (
    drafts.sort(
      (left, right) =>
        Number(Boolean(right.instructions)) * 4 +
        Number(Boolean(right.name)) * 2 +
        Number(Boolean(right.description)) +
        Number(Boolean(right.imageUrl)) -
        (Number(Boolean(left.instructions)) * 4 +
          Number(Boolean(left.name)) * 2 +
          Number(Boolean(left.description)) +
          Number(Boolean(left.imageUrl))),
    )[0] ?? null
  )
}

export function isUsableRecipeDraft(draft: RecipeDraft): boolean {
  return Boolean(draft.name && (draft.instructions || draft.description))
}

export function mergeRecipeDrafts(
  primary: RecipeDraft,
  fallback: RecipeDraft,
): RecipeDraft {
  return {
    name: primary.name || fallback.name,
    description: primary.description || fallback.description,
    instructions: primary.instructions || fallback.instructions,
    tags: [...new Set([...primary.tags, ...fallback.tags])].slice(0, 6),
    imageUrl: primary.imageUrl || fallback.imageUrl,
  }
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
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseAttributes(match[0])
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase()
    if (key && attrs.content && !result.has(key)) {
      result.set(key, attrs.content)
    }
  }
  return result
}

function resolveUrl(value: string | null, pageUrl: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, pageUrl)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function cleanTitle(value: string): string {
  return cleanText(value, 100)
    .replace(/^【步骤图】/, '')
    .replace(/(?:的做法(?:步骤)?|怎么做)(?:[_\-|｜].*)?$/u, '')
    .replace(/[_\-|｜](?:菜谱|下厨房|食谱).*$/u, '')
    .trim()
}

export function extractRecipeFromHtml(
  html: string,
  pageUrl: string,
): RecipeDraft {
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*(?:"application\/ld\+json"|'application\/ld\+json'|application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = parseRecipeJsonLd(JSON.parse(match[1].trim()))
      if (parsed && (parsed.name || parsed.instructions)) {
        return {
          ...parsed,
          imageUrl: resolveUrl(parsed.imageUrl, pageUrl),
        }
      }
    } catch {
      // Invalid JSON-LD should not prevent metadata fallback.
    }
  }

  const meta = metadata(html)
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  const name = cleanTitle(
    meta.get('og:title') ||
      meta.get('twitter:title') ||
      meta.get('name') ||
      titleMatch?.[1] ||
      '',
  )
  const description = cleanText(
    meta.get('og:description') ||
      meta.get('twitter:description') ||
      meta.get('description') ||
      '',
    2_000,
  )
  return {
    name,
    description,
    instructions: '',
    tags: stringList(meta.get('keywords')).slice(0, 6),
    imageUrl: resolveUrl(
      meta.get('og:image') ||
        meta.get('twitter:image') ||
        meta.get('image') ||
        null,
      pageUrl,
    ),
  }
}

export function htmlToVisibleText(html: string, max = 20_000): string {
  return cleanText(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|li|h[1-6]|section|article)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
    max,
  )
}
