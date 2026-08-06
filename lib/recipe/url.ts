const TRAILING_SHARE_PUNCTUATION = /[)\]}>，。！？；：、,.!?;:'"”’]+$/

function normalizeRecipeUrl(url: URL): URL {
  if (
    url.hostname.toLowerCase() === 'www.xiachufang.com' &&
    /^\/recipe\/\d+\/?$/i.test(url.pathname)
  ) {
    url.hostname = 'm.xiachufang.com'
  }
  return url
}

export function extractHttpUrl(input: string): string | null {
  const matches = input.match(/https?:\/\/[^\s<>"'，。！？；：、]+/gi)
  if (!matches) return null

  for (const match of matches) {
    const candidate = match.replace(TRAILING_SHARE_PUNCTUATION, '')
    try {
      const url = new URL(candidate)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return normalizeRecipeUrl(url).toString()
      }
    } catch {
      // Try the next URL in the share text.
    }
  }
  return null
}
