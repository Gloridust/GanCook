import 'server-only'
import { chatCompletionsUrl, type StoredLlmConfig } from './config'
import {
  buildRecipeSystemPrompt,
  buildRecipeUserPrompt,
  parseLlmRecipeOutput,
} from '@/lib/recipe/llm'
import type { RecipeDraft } from '@/lib/recipe/parse'
import { requestLlmJson } from './http'

const MAX_LLM_RESPONSE = 256 * 1024
const LLM_TIMEOUT_MS = 20_000

export async function extractRecipeWithLlm(
  config: StoredLlmConfig,
  pageUrl: string,
  visibleText: string,
  structuredDraft: RecipeDraft,
): Promise<RecipeDraft> {
  if (!config.enabled) throw new Error('LLM_NOT_CONFIGURED')
  const endpoint = new URL(chatCompletionsUrl(config.baseUrl))
  const data = await requestLlmJson(endpoint, {
    apiKey: config.apiKey,
    allowPrivateNetwork: config.allowPrivateNetwork,
    maxResponseBytes: MAX_LLM_RESPONSE,
    timeoutMs: LLM_TIMEOUT_MS,
    method: 'POST',
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 2500,
      messages: [
        {
          role: 'system',
          content: buildRecipeSystemPrompt(),
        },
        {
          role: 'user',
          content: buildRecipeUserPrompt({
            pageUrl,
            structuredDraft,
            visibleText,
          }),
        },
      ],
    }),
  })
  const content =
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as { choices?: unknown }).choices)
      ? (
          (data as {
            choices: Array<{ message?: { content?: unknown } }>
          }).choices[0]?.message?.content
        )
      : null
  if (typeof content !== 'string') throw new Error('LLM_REQUEST_FAILED')
  return parseLlmRecipeOutput(content)
}
