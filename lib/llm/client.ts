import 'server-only'
import { chatCompletionsUrl, type StoredLlmConfig } from './config'
import {
  buildRecipeSystemPrompt,
  buildRecipeUserPrompt,
  parseLlmRecipeOutput,
} from '@/lib/recipe/llm'
import type { RecipeDraft } from '@/lib/recipe/parse'
import { LlmHttpError, requestLlmJson } from './http'
import { completionContent } from './json'
import { RECIPE_LLM_TIMEOUT_MS } from './timeouts'

const MAX_LLM_RESPONSE = 256 * 1024

// 确认不支持 response_format 的服务（带上就 400/422、去掉就成功）记在进程内，之后直接不带
const g = globalThis as unknown as { __gancookNoJsonMode?: Set<string> }
const noJsonMode = (g.__gancookNoJsonMode ??= new Set<string>())

export type ChatJsonOptions = {
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
  temperature?: number
  /**
   * 请求 JSON 模式（response_format: json_object）。默认关闭：菜谱导入沿用原来的请求方式，
   * 只有新功能显式开启。服务不支持时自动去掉重试。
   */
  jsonMode?: boolean
}

/**
 * 通用「要一个 JSON 对象」的对话调用（OpenAI 兼容 chat/completions）。
 * 返回模型正文，由调用方解析校验。
 */
export async function chatJson(
  config: StoredLlmConfig,
  options: ChatJsonOptions,
): Promise<string> {
  if (!config.enabled) throw new Error('LLM_NOT_CONFIGURED')
  const endpoint = new URL(chatCompletionsUrl(config.baseUrl))
  const target = `${endpoint.toString()}#${config.model}`

  const call = async (jsonMode: boolean) => {
    const data = await requestLlmJson(endpoint, {
      apiKey: config.apiKey,
      allowPrivateNetwork: config.allowPrivateNetwork,
      maxResponseBytes: MAX_LLM_RESPONSE,
      timeoutMs: options.timeoutMs,
      method: 'POST',
      body: JSON.stringify({
        model: config.model,
        temperature: options.temperature ?? 0,
        max_tokens: options.maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: options.system },
          { role: 'user', content: options.user },
        ],
      }),
    })
    const content = completionContent(data)
    if (content === null) throw new Error('LLM_REQUEST_FAILED')
    return content
  }

  if (!options.jsonMode || noJsonMode.has(target)) return call(false)

  let first: string
  try {
    first = await call(true)
  } catch (error) {
    const maybeUnsupported =
      error instanceof LlmHttpError && (error.status === 400 || error.status === 422)
    if (!maybeUnsupported) throw error
    // 400/422 也可能是模型名、上下文长度等其他原因：去掉后真成功了，才认定是不支持 JSON 模式
    const content = await call(false)
    noJsonMode.add(target)
    return content
  }
  // 部分推理模型开了 JSON 模式会回空正文：不带参数再试一次
  return first.trim() ? first : call(false)
}

export async function extractRecipeWithLlm(
  config: StoredLlmConfig,
  pageUrl: string,
  visibleText: string,
  structuredDraft: RecipeDraft,
): Promise<RecipeDraft> {
  const content = await chatJson(config, {
    system: buildRecipeSystemPrompt(),
    user: buildRecipeUserPrompt({ pageUrl, structuredDraft, visibleText }),
    maxTokens: 2500,
    timeoutMs: RECIPE_LLM_TIMEOUT_MS,
  })
  return parseLlmRecipeOutput(content)
}
