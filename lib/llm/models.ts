import {
  assertLlmEndpointUrl,
  LlmHttpError,
  requestLlmJson,
} from './http'
import {
  modelsUrl,
  parseModelIds,
} from './model-list'
import type { LlmProvider } from './config'
import { LLM_MODEL_DISCOVERY_TIMEOUT_MS } from './timeouts'

const MAX_MODELS_RESPONSE_BYTES = 256 * 1024
export const DEEPSEEK_KNOWN_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
] as const

export { assertLlmEndpointUrl }
export {
  chooseDiscoveredModel,
  modelsUrl,
  parseModelIds,
} from './model-list'

type DiscoveryTarget = {
  provider: LlmProvider
  baseUrl: string
}

function isOfficialDeepSeekTarget(target: DiscoveryTarget): boolean {
  if (target.provider !== 'deepseek') return false
  try {
    const url = new URL(target.baseUrl)
    return (
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'api.deepseek.com' &&
      !url.port &&
      (url.pathname === '/' || /^\/v1\/?$/.test(url.pathname))
    )
  } catch {
    return false
  }
}

export function fallbackModelsForDiscoveryError(
  target: DiscoveryTarget,
  error: unknown,
): readonly string[] | null {
  if (
    !isOfficialDeepSeekTarget(target) ||
    !(error instanceof LlmHttpError) ||
    (error.status !== 404 && error.status !== 405)
  ) {
    return null
  }
  return DEEPSEEK_KNOWN_MODELS
}

export async function discoverLlmModels(input: {
  provider: LlmProvider
  baseUrl: string
  apiKey: string
  allowPrivateNetwork: boolean
}): Promise<string[]> {
  const endpoint = new URL(modelsUrl(input.baseUrl))
  try {
    const response = await requestLlmJson(endpoint, {
      apiKey: input.apiKey,
      allowPrivateNetwork: input.allowPrivateNetwork,
      maxResponseBytes: MAX_MODELS_RESPONSE_BYTES,
      timeoutMs: LLM_MODEL_DISCOVERY_TIMEOUT_MS,
    })
    return parseModelIds(response)
  } catch (error) {
    const fallback = fallbackModelsForDiscoveryError(input, error)
    if (fallback) return [...fallback]
    throw error
  }
}
