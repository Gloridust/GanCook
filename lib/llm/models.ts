import {
  assertLlmEndpointUrl,
  requestLlmJson,
} from './http'
import {
  modelsUrl,
  parseModelIds,
} from './model-list'

const MAX_MODELS_RESPONSE_BYTES = 256 * 1024
const MODELS_TIMEOUT_MS = 8_000

export { assertLlmEndpointUrl }
export {
  defaultDiscoveredModel,
  modelsUrl,
  parseModelIds,
} from './model-list'

export async function discoverLlmModels(input: {
  baseUrl: string
  apiKey: string
  allowPrivateNetwork: boolean
}): Promise<string[]> {
  const endpoint = new URL(modelsUrl(input.baseUrl))
  const response = await requestLlmJson(endpoint, {
    apiKey: input.apiKey,
    allowPrivateNetwork: input.allowPrivateNetwork,
    maxResponseBytes: MAX_MODELS_RESPONSE_BYTES,
    timeoutMs: MODELS_TIMEOUT_MS,
  })
  return parseModelIds(response)
}
