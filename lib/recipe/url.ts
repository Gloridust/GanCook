const TRAILING_SHARE_PUNCTUATION =
  /[)\]}>）】》」』，。！？；：、,.!?;:'"”’]+$/
const URL_CANDIDATE =
  /https?:\/\/[^\s<>"'）】》」』，。！？；：、]+|(?<![A-Za-z0-9+./:-])(?:www\.)?(?:xhslink\.com|xiaohongshu\.com|xiachufang\.com)\/[^\s<>"'）】》」』，。！？；：、]+/gi

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
  const matches = [...input.matchAll(URL_CANDIDATE)]
  if (!matches) return null

  const candidates: Array<{ url: URL; priority: number; order: number }> = []
  for (const [order, match] of matches.entries()) {
    const prefix = input.slice(0, match.index ?? 0)
    if (/(?:javascript|blob|data|ftp):[^\s]*$/i.test(prefix)) continue
    const candidate = match[0].replace(TRAILING_SHARE_PUNCTUATION, '')
    try {
      const url = new URL(
        /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`,
      )
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const hostname = url.hostname.toLowerCase()
        const priority =
          hostname === 'xhslink.com' ||
          hostname.endsWith('.xhslink.com') ||
          hostname === 'xiaohongshu.com' ||
          hostname.endsWith('.xiaohongshu.com')
            ? 0
            : hostname === 'xiachufang.com' ||
                hostname.endsWith('.xiachufang.com')
              ? 1
              : 2
        candidates.push({
          url: normalizeRecipeUrl(url),
          priority,
          order,
        })
      }
    } catch {
      // Try the next URL in the share text.
    }
  }
  candidates.sort(
    (left, right) =>
      left.priority - right.priority || left.order - right.order,
  )
  return candidates[0]?.url.toString() ?? null
}
