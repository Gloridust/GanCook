'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useT } from '@/components/i18n-provider'
import {
  discoverLlmModels,
  updateLlmSettings,
} from '@/lib/actions/admin'
import {
  LLM_DEFAULTS,
  type LlmProvider,
  type PublicLlmConfig,
} from '@/lib/llm/config'
import { defaultDiscoveredModel } from '@/lib/llm/model-list'

export function LlmSettings({ config }: { config: PublicLlmConfig }) {
  const t = useT()
  const [provider, setProvider] = useState<LlmProvider>(config.provider)
  const [baseUrl, setBaseUrl] = useState(config.baseUrl)
  const [model, setModel] = useState(config.model)
  const [apiKey, setApiKey] = useState('')
  const [enabled, setEnabled] = useState(config.enabled)
  const [allowPrivateNetwork, setAllowPrivateNetwork] = useState(
    config.allowPrivateNetwork,
  )
  const [keyConfigured, setKeyConfigured] = useState(config.apiKeyConfigured)
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [saving, startSaving] = useTransition()
  const [discovering, startDiscovering] = useTransition()

  const changeProvider = (next: LlmProvider) => {
    setProvider(next)
    setBaseUrl(LLM_DEFAULTS[next].baseUrl)
    setModel(LLM_DEFAULTS[next].model)
    setModelOptions([])
  }

  const save = () => {
    setMessage('')
    startSaving(async () => {
      const res = await updateLlmSettings({
        provider,
        baseUrl,
        model,
        apiKey,
        enabled,
        allowPrivateNetwork,
      })
      if (res.ok) {
        setProvider(res.config.provider)
        setBaseUrl(res.config.baseUrl)
        setModel(res.config.model)
        setEnabled(res.config.enabled)
        setAllowPrivateNetwork(res.config.allowPrivateNetwork)
        setKeyConfigured(res.config.apiKeyConfigured)
        setApiKey('')
        setMessage(t('common.saved'))
      } else {
        setMessage(res.error)
      }
    })
  }

  const discover = () => {
    setMessage('')
    startDiscovering(async () => {
      const res = await discoverLlmModels({
        provider,
        baseUrl,
        apiKey,
        allowPrivateNetwork,
      })
      if (res.ok) {
        setModelOptions(res.models)
        setModel(defaultDiscoveredModel(res.models))
        setMessage(t('admin.llmModelsFound', { n: res.models.length }))
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
        <p className="mt-1.5 text-xs text-secondary">
          {t('admin.llmOpenAiCompatibleDesc')}
        </p>
      </div>

      <div>
        <Label htmlFor="llm-base-url">{t('admin.llmBaseUrl')}</Label>
        <Input
          id="llm-base-url"
          value={baseUrl}
          onChange={(event) => {
            setBaseUrl(event.target.value)
            setModelOptions([])
          }}
          placeholder={LLM_DEFAULTS[provider].baseUrl}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <Label htmlFor="llm-model" className="mb-0">
            {t('admin.llmModel')}
          </Label>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={discovering}
            onClick={discover}
          >
            {t('admin.llmFetchModels')}
          </Button>
        </div>
        <Input
          id="llm-model"
          list="llm-model-options"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={LLM_DEFAULTS[provider].model}
          autoCapitalize="none"
          spellCheck={false}
        />
        <datalist id="llm-model-options">
          {modelOptions.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        <p className="mt-1.5 text-xs text-secondary">
          {t('admin.llmModelCustomHint')}
        </p>
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

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="relative text-[15px] text-ink">
            {t('admin.llmAllowPrivateNetwork')}
          </p>
          <p className="relative text-xs text-secondary">
            {t('admin.llmAllowPrivateNetworkDesc')}
          </p>
        </div>
        <Switch
          checked={allowPrivateNetwork}
          onChange={setAllowPrivateNetwork}
        />
      </div>
      {allowPrivateNetwork && (
        <p className="rounded-2xl bg-warn/10 px-3 py-2 text-xs text-warn">
          {t('admin.llmAllowPrivateNetworkWarning')}
        </p>
      )}

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
        <Button loading={saving} onClick={save}>
          {t('admin.saveSettings')}
        </Button>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>
    </div>
  )
}
