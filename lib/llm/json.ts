/**
 * 从模型回复里取出 JSON 对象文本。兼容：
 * - ```json 代码块包裹
 * - 推理模型（Qwen3 / DeepSeek-R1 本地部署等）把思考过程写进 <think>…</think>
 * - JSON 前后夹带说明文字
 */
export function jsonObjectFrom(raw: string): string {
  const unfenced = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('LLM_INVALID_JSON')
  return unfenced.slice(start, end + 1)
}

/** 取 chat/completions 回复正文（content 可能是字符串，也可能是分段数组） */
export function completionContent(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const choices = (data as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return null
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)
    ?.message?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    const text = content
      .map((part) =>
        typeof part === 'object' && part !== null && 'text' in part
          ? String((part as { text: unknown }).text ?? '')
          : '',
      )
      .join('')
    return text || null
  }
  return null
}
