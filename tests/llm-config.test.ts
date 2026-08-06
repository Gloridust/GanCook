import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLlmSettingUpdates,
  chatCompletionsUrl,
  toPublicLlmConfig,
  type StoredLlmConfig,
} from '../lib/llm/config'

const existing: StoredLlmConfig = {
  provider: 'deepseek',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  apiKey: 'secret-old-key',
  enabled: true,
}

test('blank API key update preserves the existing key for the same endpoint', () => {
  const updated = buildLlmSettingUpdates(existing, {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    apiKey: '   ',
    enabled: false,
  })

  assert.equal(updated.apiKey, 'secret-old-key')
  assert.equal(updated.provider, 'deepseek')
  assert.equal(updated.enabled, false)
})

test('blank API key update clears the old key when the endpoint changes', () => {
  const updated = buildLlmSettingUpdates(existing, {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
    enabled: true,
  })

  assert.equal(updated.apiKey, '')
  assert.equal(updated.provider, 'openai')
})

test('API keys are rejected for plaintext HTTP endpoints', () => {
  assert.throws(
    () =>
      buildLlmSettingUpdates(existing, {
        provider: 'openai',
        baseUrl: 'http://llm.example/v1',
        model: 'custom-model',
        apiKey: 'secret-new-key',
        enabled: true,
      }),
    /INSECURE_LLM_BASE_URL/,
  )
})

test('public LLM config never exposes or serializes the API key', () => {
  const publicConfig = toPublicLlmConfig(existing)

  assert.deepEqual(publicConfig, {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    enabled: true,
    apiKeyConfigured: true,
  })
  assert.equal('apiKey' in publicConfig, false)
  assert.equal(JSON.stringify(publicConfig).includes('secret-old-key'), false)
})

test('deepseek defaults are applied when switching provider with empty fields', () => {
  const updated = buildLlmSettingUpdates(existing, {
    provider: 'deepseek',
    baseUrl: '',
    model: '',
    apiKey: 'new-key',
    enabled: true,
  })

  assert.equal(updated.baseUrl, 'https://api.deepseek.com')
  assert.equal(updated.model, 'deepseek-chat')
  assert.equal(updated.apiKey, 'new-key')
})

test('chatCompletionsUrl supports base URLs and already-complete endpoints', () => {
  assert.equal(
    chatCompletionsUrl('https://api.deepseek.com'),
    'https://api.deepseek.com/chat/completions',
  )
  assert.equal(
    chatCompletionsUrl('https://llm.example/v1/'),
    'https://llm.example/v1/chat/completions',
  )
  assert.equal(
    chatCompletionsUrl('https://llm.example/v1/chat/completions'),
    'https://llm.example/v1/chat/completions',
  )
})
