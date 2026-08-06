'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/components/i18n-provider'
import { updateLlmSettings } from '@/lib/actions/admin'
import {
  LLM_DEFAULTS,
  type LlmProvider,
  type PublicLlmConfig,
} from '@/lib/llm/config'

export function LlmSettings({ config }: { config: PublicLlmConfig }) {
  const t = useT()
  const [provider, setProvider] = useState<LlmProvider>(config.provider)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [model, setModel] = useState(config.model)
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(config.enabled)
  const [keyConfigured, setKeyConfigured] = useState(config.apiKeyConfigured)
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  const changeProvider = (next: LlmProvider) => {
    setProvider(next)
    setBaseUrl(LLM_DEFAULTS[next].baseUrl)
    setModel(LLM_DEFAULTS[next].model)
  }

  const save = () => {
    setMessage('')
    startTransition(async () => {
      const res = await updateLlmSettings({
        provider,
        baseUrl,
        model,
        apiKey,
        enabled,
      })
      if (res.ok) {
        setProvider(res.config.provider)
        setBaseUrl(res.config.baseUrl)
        setModel(res.config.model)
        setEnabled(res.config.enabled)
        setKeyConfigured(res.config.apiKeyConfigured)
        setApiKey('')
        setMessage(t('common.saved'))
      } else {
        setMessage(res.error)
      }
    })
  }

  return (
    <div className="mf-raised space-y-4 p-4">
      <div>
        <Label>{t('admin.llmProvider')}</Label>
        <Segmented
          value={provider}
          onChange={changeProvider}
          layoutId="llm-provider"
          options={[
            { value: 'deepseek', label: 'DeepSeek' },
            { value: 'openai', label: t('admin.llmOpenAiCompatible') },
          ]}
        />
      </div>

      <div>
        <Label htmlFor="llm-base-url">{t('admin.llmBaseUrl')}</Label>
        <Input
          id="llm-base-url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={LLM_DEFAULTS[provider].baseUrl}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      <div>
        <Label htmlFor="llm-model">{t('admin.llmModel')}</Label>
        <Input
          id="llm-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={LLM_DEFAULTS[provider].model}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="llm-api-key" className="mb-0">
            {t('admin.llmApiKey')}
          </Label>
          <span className="text-xs text-secondary">
            {keyConfigured
              ? t('admin.llmKeyConfigured')
              : t('admin.llmKeyMissing')}
          </span>
        </div>
        <Input
          id="llm-api-key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t('admin.llmApiKeyPh')}
          autoComplete="new-password"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="relative text-[15px] text-ink">
            {t('admin.llmEnabled')}
          </p>
          <p className="relative text-xs text-secondary">
            {t('admin.llmEnabledDesc')}
          </p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <div className="flex items-center gap-3">
        <Button loading={pending} onClick={save}>
          {t('admin.saveSettings')}
        </Button>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>
    </div>
  )
}
