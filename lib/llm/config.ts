export type LlmProvider = 'deepseek' | 'openai'

export type StoredLlmConfig = {
  provider: LlmProvider
  baseUrl: string
  model: string
  apiKey: string
  enabled: boolean
  allowPrivateNetwork: boolean
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
  allowPrivateNetwork: boolean
}

export type LlmRequestConfigInput = Pick<
  LlmConfigInput,
  'provider' | 'baseUrl' | 'apiKey' | 'allowPrivateNetwork'
>

export type LlmRequestConfig = Pick<
  StoredLlmConfig,
  'provider' | 'baseUrl' | 'apiKey' | 'allowPrivateNetwork'
>

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

export function normalizeLlmBaseUrl(
  value: string,
  provider: LlmProvider,
  allowPrivateNetwork: boolean,
): string {
  const raw = value.trim() || LLM_DEFAULTS[provider].baseUrl
  const url = new URL(raw)
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password
  ) {
    throw new Error('INVALID_LLM_BASE_URL')
  }
  if (!allowPrivateNetwork && url.protocol !== 'https:') {
    throw new Error('INSECURE_LLM_BASE_URL')
  }
  if (
    provider === 'deepseek' &&
    url.protocol === 'https:' &&
    url.hostname.toLowerCase() === 'api.deepseek.com' &&
    !url.port &&
    (url.pathname === '/' || /^\/v1\/?$/.test(url.pathname))
  ) {
    url.pathname = '/'
    url.search = ''
    url.hash = ''
  }
  return url.toString().replace(/\/$/, '')
}

function sameCredentialTarget(
  existing: StoredLlmConfig,
  baseUrl: string,
): boolean {
  try {
    return (
      normalizeLlmBaseUrl(
        existing.baseUrl,
        existing.provider,
        existing.allowPrivateNetwork,
      ) === baseUrl
    )
  } catch {
    return false
  }
}

export function resolveLlmRequestConfig(
  existing: StoredLlmConfig,
  input: LlmRequestConfigInput,
): LlmRequestConfig {
  const provider: LlmProvider =
    input.provider === 'openai' ? 'openai' : 'deepseek'
  const baseUrl = normalizeLlmBaseUrl(
    input.baseUrl,
    provider,
    input.allowPrivateNetwork,
  )
  const suppliedApiKey = input.apiKey.trim()
  return {
    provider,
    baseUrl,
    apiKey:
      suppliedApiKey ||
      (sameCredentialTarget(existing, baseUrl) ? existing.apiKey : ''),
    allowPrivateNetwork: input.allowPrivateNetwork,
  }
}

export function buildLlmSettingUpdates(
  existing: StoredLlmConfig,
  input: LlmConfigInput,
): StoredLlmConfig {
  const requestConfig = resolveLlmRequestConfig(existing, input)
  return {
    ...requestConfig,
    model: input.model.trim() || LLM_DEFAULTS[requestConfig.provider].model,
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
    allowPrivateNetwork: config.allowPrivateNetwork,
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
