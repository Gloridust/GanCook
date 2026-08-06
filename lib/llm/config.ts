export type LlmProvider = 'deepseek' | 'openai'

export type StoredLlmConfig = {
  provider: LlmProvider
  baseUrl: string
  model: string
  apiKey: string
  enabled: boolean
}

export type PublicLlmConfig = Omit<StoredLlmConfig, 'apiKey'> & {
  apiKeyConfigured: boolean
}

export type LlmConfigInput = {
  provider: LlmProvider
  baseUrl: string
  model: string
  apiKey: string
  enabled: boolean
}

export const LLM_DEFAULTS: Record<
  LlmProvider,
  Pick<StoredLlmConfig, 'baseUrl' | 'model'>
> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
}

function normalizeBaseUrl(value: string, provider: LlmProvider): string {
  const raw = value.trim() || LLM_DEFAULTS[provider].baseUrl
  const url = new URL(raw)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('INVALID_LLM_BASE_URL')
  }
  return url.toString().replace(/\/$/, '')
}

function sameCredentialTarget(
  existing: StoredLlmConfig,
  provider: LlmProvider,
  baseUrl: string,
): boolean {
  try {
    return (
      existing.provider === provider &&
      normalizeBaseUrl(existing.baseUrl, existing.provider) === baseUrl
    )
  } catch {
    return false
  }
}

export function buildLlmSettingUpdates(
  existing: StoredLlmConfig,
  input: LlmConfigInput,
): StoredLlmConfig {
  const provider: LlmProvider =
    input.provider === 'openai' ? 'openai' : 'deepseek'
  const baseUrl = normalizeBaseUrl(input.baseUrl, provider)
  const suppliedApiKey = input.apiKey.trim()
  const apiKey =
    suppliedApiKey ||
    (sameCredentialTarget(existing, provider, baseUrl) ? existing.apiKey : '')
  if (apiKey && new URL(baseUrl).protocol !== 'https:') {
    throw new Error('INSECURE_LLM_BASE_URL')
  }
  return {
    provider,
    baseUrl,
    model: input.model.trim() || LLM_DEFAULTS[provider].model,
    apiKey,
    enabled: input.enabled,
  }
}

export function toPublicLlmConfig(
  config: StoredLlmConfig,
): PublicLlmConfig {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    enabled: config.enabled,
    apiKeyConfigured: Boolean(config.apiKey),
  }
}

export function chatCompletionsUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  const path = url.pathname.replace(/\/+$/, '')
  if (!path.endsWith('/chat/completions')) {
    url.pathname = `${path}/chat/completions`.replace(/^\/\//, '/')
  }
  url.search = ''
  url.hash = ''
  return url.toString()
}
