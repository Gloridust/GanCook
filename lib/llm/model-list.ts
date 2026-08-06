const MAX_DISCOVERED_MODELS = 200

export function modelsUrl(baseUrl: string): string {
  const url = new URL(baseUrl)
  let path = url.pathname.replace(/\/+$/, '')
  if (path.endsWith('/chat/completions')) {
    path = path.slice(0, -'/chat/completions'.length)
  }
  if (!path.endsWith('/models')) {
    path = `${path}/models`
  }
  url.pathname = path || '/models'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export function parseModelIds(
  value: unknown,
  limit = MAX_DISCOVERED_MODELS,
): string[] {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Array.isArray((value as { data?: unknown }).data)
  ) {
    throw new Error('LLM_MODELS_INVALID')
  }
  const ids = [
    ...new Set(
      (value as { data: unknown[] }).data
        .map((item) =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { id?: unknown }).id === 'string'
            ? (item as { id: string }).id.trim()
            : '',
        )
        .filter((id) => id.length > 0 && id.length <= 200),
    ),
  ]
    .sort()
    .slice(0, Math.max(0, Math.min(limit, MAX_DISCOVERED_MODELS)))
  if (ids.length === 0) throw new Error('LLM_MODELS_INVALID')
  return ids
}

export function defaultDiscoveredModel(models: readonly string[]): string {
  return models[0] ?? ''
}
