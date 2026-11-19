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

// 不支持 response_format 的服务（部分自建 / 旧版兼容网关、推理模型）会回 400/422，
// 记住后同一进程内不再带这个参数，省一次失败请求
const g = globalThis as unknown as { __gancookNoJsonMode?: Set<string> }
const noJsonMode = (g.__gancookNoJsonMode ??= new Set<string>())

export type ChatJsonOptions = {
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
  temperature?: number
}

/**
 * 通用「要一个 JSON 对象」的对话调用（OpenAI 兼容 chat/completions）。
 * 优先开启 JSON 模式（response_format: json_object），服务不支持时自动去掉重试。
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

  if (noJsonMode.has(target)) return call(false)
  try {
    return await call(true)
  } catch (error) {
    if (
      error instanceof LlmHttpError &&
      (error.status === 400 || error.status === 422)
    ) {
      noJsonMode.add(target)
      return call(false)
    }
    throw error
  }
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
