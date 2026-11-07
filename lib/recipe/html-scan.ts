/**
 * 线性时间的 HTML 扫描工具。
 *
 * 菜谱导入会解析任意外部网页；形如 /<script\b[\s\S]*?<\/script>/ 的正则在「标签未闭合」时
 * 对每个起点都会扫到文末，复杂度 O(n²)——一个 150KB 的恶意页面就能把事件循环卡住数秒，
 * 3MB 则是数十分钟，全家都用不了。这里一律用 indexOf 单向扫描：找不到闭合标签就丢弃剩余部分。
 */

/** 交给解析器的 HTML 上限（菜谱正文、JSON-LD、小红书初始状态都远小于此） */
export const MAX_PARSE_HTML = 1_500_000

export function capHtml(html: string): string {
  return html.length > MAX_PARSE_HTML ? html.slice(0, MAX_PARSE_HTML) : html
}

function isTagBoundary(ch: string | undefined): boolean {
  return ch === undefined || ch === '>' || ch === '/' || /\s/.test(ch)
}

export type HtmlElement = {
  /** 开始标签全文，如 <script type="application/ld+json"> */
  openTag: string
  /** 开始与结束标签之间的原始内容 */
  inner: string
}

/**
 * 依次找出 <tag ...>...</tag>（不区分大小写，不处理嵌套——script/style/title 本来也不嵌套）。
 * 遇到没有闭合的元素即停止。
 */
export function findElements(html: string, tag: string): HtmlElement[] {
  const lower = html.toLowerCase()
  const open = `<${tag.toLowerCase()}`
  const close = `</${tag.toLowerCase()}`
  const out: HtmlElement[] = []
  let pos = 0
  while (pos < lower.length) {
    const start = lower.indexOf(open, pos)
    if (start < 0) break
    if (!isTagBoundary(lower[start + open.length])) {
      pos = start + open.length
      continue
    }
    const openEnd = lower.indexOf('>', start + open.length)
    if (openEnd < 0) break
    const closeStart = lower.indexOf(close, openEnd + 1)
    if (closeStart < 0) break
    const closeEnd = lower.indexOf('>', closeStart + close.length)
    out.push({
      openTag: html.slice(start, openEnd + 1),
      inner: html.slice(openEnd + 1, closeStart),
    })
    pos = closeEnd < 0 ? lower.length : closeEnd + 1
  }
  return out
}

export function firstElementInner(html: string, tag: string): string | undefined {
  return findElements(html, tag)[0]?.inner
}

/** 删除注释与 script/style/noscript/svg 整块（未闭合时删到文末） */
export function stripNonVisibleBlocks(html: string): string {
  const lower = html.toLowerCase()
  const blocks = ['script', 'style', 'noscript', 'svg']
  let out = ''
  let pos = 0
  while (pos < html.length) {
    const lt = lower.indexOf('<', pos)
    if (lt < 0) {
      out += html.slice(pos)
      break
    }
    out += html.slice(pos, lt)

    if (lower.startsWith('<!--', lt)) {
      const end = lower.indexOf('-->', lt + 4)
      out += ' '
      if (end < 0) break
      pos = end + 3
      continue
    }

    const block = blocks.find(
      (b) => lower.startsWith(b, lt + 1) && isTagBoundary(lower[lt + 1 + b.length]),
    )
    if (block) {
      const closeStart = lower.indexOf(`</${block}`, lt + 1 + block.length)
      out += ' '
      if (closeStart < 0) break
      const closeEnd = lower.indexOf('>', closeStart)
      if (closeEnd < 0) break
      pos = closeEnd + 1
      continue
    }

    out += '<'
    pos = lt + 1
  }
  return out
}

/** 安全的 HTML 数字实体解码：超出 Unicode 范围的码点原样保留（String.fromCodePoint 会抛 RangeError） */
export function codePointOrEntity(n: number, entity: string): string {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff
    ? String.fromCodePoint(n)
    : entity
}
