export type LlmDiscoveryErrorKey =
  | 'err.llmModelsAuthInvalid'
  | 'err.llmModelsRateLimited'
  | 'err.llmModelsTimeout'
  | 'err.llmModelsResponseInvalid'
  | 'err.llmModelsFailed'

export function llmDiscoveryErrorKey(error: unknown): LlmDiscoveryErrorKey {
  const code = error instanceof Error ? error.message : ''
  switch (code) {
    case 'LLM_AUTH_INVALID':
      return 'err.llmModelsAuthInvalid'
    case 'LLM_RATE_LIMITED':
      return 'err.llmModelsRateLimited'
    case 'LLM_TIMEOUT':
      return 'err.llmModelsTimeout'
    case 'LLM_RESPONSE_INVALID':
    case 'LLM_MODELS_INVALID':
      return 'err.llmModelsResponseInvalid'
    default:
      return 'err.llmModelsFailed'
  }
}
