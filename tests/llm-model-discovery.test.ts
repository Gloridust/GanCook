import assert from 'node:assert/strict'
import { createServer, type RequestListener, type Server } from 'node:http'
import test from 'node:test'
import {
  assertLlmEndpointUrl,
  defaultDiscoveredModel,
  discoverLlmModels,
  modelsUrl,
  parseModelIds,
} from '../lib/llm/models'
import { requestLlmJson } from '../lib/llm/http'

async function listen(
  handler: RequestListener,
): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer(handler)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.notEqual(address, null)
  assert.equal(typeof address, 'object')
  return {
    server,
    baseUrl: `http://127.0.0.1:${(address as { port: number }).port}`,
  }
}

async function close(server: Server): Promise<void> {
  server.closeAllConnections()
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}

test('modelsUrl handles base, v1, and chat completion endpoint forms', () => {
  assert.equal(modelsUrl('https://llm.example'), 'https://llm.example/models')
  assert.equal(modelsUrl('https://llm.example/v1/'), 'https://llm.example/v1/models')
  assert.equal(
    modelsUrl('https://llm.example/v1/chat/completions'),
    'https://llm.example/v1/models',
  )
  assert.equal(
    modelsUrl('https://llm.example/chat/completions?ignored=1'),
    'https://llm.example/models',
  )
})

test('parseModelIds reads OpenAI data, removes invalid duplicates, sorts, and caps results', () => {
  assert.deepEqual(
    parseModelIds(
      {
        data: [
          { id: 'z-model' },
          { id: 'a-model' },
          { id: 'z-model' },
          { id: '' },
          { nope: 'ignored' },
        ],
      },
      2,
    ),
    ['a-model', 'z-model'],
  )
  assert.throws(() => parseModelIds({ models: [] }), /LLM_MODELS_INVALID/)
})

test('model discovery selects the first sorted model as the default', () => {
  assert.equal(defaultDiscoveredModel(['model-a', 'model-b']), 'model-a')
  assert.equal(defaultDiscoveredModel([]), '')
})

test('LLM endpoints reject HTTP and local targets by default but allow them with the admin switch', () => {
  assert.throws(
    () => assertLlmEndpointUrl('http://127.0.0.1:4000/v1', false),
    /LLM_UNSAFE_ENDPOINT/,
  )
  assert.throws(
    () => assertLlmEndpointUrl('https://localhost:4000/v1', false),
    /LLM_UNSAFE_ENDPOINT/,
  )
  assert.equal(
    assertLlmEndpointUrl('http://host.docker.internal:4000/v1', true).hostname,
    'host.docker.internal',
  )
})

test('model discovery sends the supplied Bearer key and supports an explicitly allowed local HTTP endpoint', async () => {
  let authorization = ''
  const { server, baseUrl } = await listen((request, response) => {
    authorization = String(request.headers.authorization ?? '')
    response.setHeader('Content-Type', 'application/json')
    response.end(
      JSON.stringify({
        data: [{ id: 'model-b' }, { id: 'model-a' }, { id: 'model-a' }],
      }),
    )
  })

  try {
    await assert.rejects(
      discoverLlmModels({
        baseUrl,
        apiKey: 'new-form-key',
        allowPrivateNetwork: false,
      }),
      /LLM_UNSAFE_ENDPOINT/,
    )
    assert.deepEqual(
      await discoverLlmModels({
        baseUrl,
        apiKey: 'new-form-key',
        allowPrivateNetwork: true,
      }),
      ['model-a', 'model-b'],
    )
    assert.equal(authorization, 'Bearer new-form-key')
  } finally {
    await close(server)
  }
})

test('LLM JSON requests enforce response size and timeout limits', async () => {
  const oversized = await listen((_request, response) => {
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify({ data: [{ id: 'x'.repeat(200) }] }))
  })
  try {
    await assert.rejects(
      requestLlmJson(new URL(`${oversized.baseUrl}/models`), {
        apiKey: '',
        allowPrivateNetwork: true,
        maxResponseBytes: 32,
        timeoutMs: 1_000,
      }),
      /LLM_RESPONSE_TOO_LARGE/,
    )
  } finally {
    await close(oversized.server)
  }

  const stalled = await listen(() => {})
  try {
    await assert.rejects(
      requestLlmJson(new URL(`${stalled.baseUrl}/models`), {
        apiKey: '',
        allowPrivateNetwork: true,
        maxResponseBytes: 1024,
        timeoutMs: 25,
      }),
      /LLM_TIMEOUT/,
    )
  } finally {
    await close(stalled.server)
  }
})
