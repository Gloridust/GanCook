import 'server-only'
import { getSetting } from '@/lib/settings'
import {
  LLM_DEFAULTS,
  toPublicLlmConfig,
  type LlmProvider,
  type PublicLlmConfig,
  type StoredLlmConfig,
} from './config'

export const LLM_SETTING_KEYS = {
  provider: 'llm.provider',
  baseUrl: 'llm.baseUrl',
  model: 'llm.model',
  apiKey: 'llm.apiKey',
  enabled: 'llm.enabled',
} as const

export function getStoredLlmConfig(): StoredLlmConfig {
  const provider: LlmProvider =
    getSetting(LLM_SETTING_KEYS.provider) === 'openai'
      ? 'openai'
      : 'deepseek'
  return {
    provider,
    baseUrl:
      getSetting(LLM_SETTING_KEYS.baseUrl) || LLM_DEFAULTS[provider].baseUrl,
    model: getSetting(LLM_SETTING_KEYS.model) || LLM_DEFAULTS[provider].model,
    apiKey: getSetting(LLM_SETTING_KEYS.apiKey) || '',
    enabled: getSetting(LLM_SETTING_KEYS.enabled) === '1',
  }
}

export function getPublicLlmConfig(): PublicLlmConfig {
  return toPublicLlmConfig(getStoredLlmConfig())
}
