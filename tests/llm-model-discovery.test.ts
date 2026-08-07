import assert from 'node:assert/strict'
import { createServer, type RequestListener, type Server } from 'node:http'
import test from 'node:test'
import {
  assertLlmEndpointUrl,
  chooseDiscoveredModel,
  DEEPSEEK_KNOWN_MODELS,
  discoverLlmModels,
  fallbackModelsForDiscoveryError,
  modelsUrl,
  parseModelIds,
} from '../lib/llm/models'
import {
  LlmHttpError,
  requestLlmJson,
} from '../lib/llm/http'
import {
  llmDiscoveryErrorKey,
} from '../lib/llm/discovery-error'
import {
  LLM_MODEL_DISCOVERY_TIMEOUT_MS,
} from '../lib/llm/timeouts'
import { dictionaries } from '../lib/i18n/dictionaries'

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

test('model selection preserves a current discovered model and otherwise uses provider defaults', () => {
  assert.equal(
    chooseDiscoveredModel(
      ['deepseek-chat', 'deepseek-reasoner'],
      'deepseek-reasoner',
      'deepseek',
    ),
    'deepseek-reasoner',
  )
  assert.equal(
    chooseDiscoveredModel(
      ['deepseek-reasoner', 'deepseek-chat'],
      'custom-model',
      'deepseek',
    ),
    'deepseek-chat',
  )
  assert.equal(
    chooseDiscoveredModel(['model-b', 'model-a'], 'missing', 'openai'),
    'model-b',
  )
  assert.equal(chooseDiscoveredModel([], 'current', 'openai'), 'current')
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
        provider: 'openai',
        baseUrl,
        apiKey: 'new-form-key',
        allowPrivateNetwork: false,
      }),
      /LLM_UNSAFE_ENDPOINT/,
    )
    assert.deepEqual(
      await discoverLlmModels({
        provider: 'openai',
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

test('official DeepSeek discovery falls back only when the model-list endpoint is unavailable', () => {
  assert.deepEqual(
    fallbackModelsForDiscoveryError(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
      },
      new LlmHttpError('LLM_REQUEST_FAILED', 404),
    ),
    DEEPSEEK_KNOWN_MODELS,
  )
  assert.deepEqual(
    fallbackModelsForDiscoveryError(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
      },
      new LlmHttpError('LLM_REQUEST_FAILED', 405),
    ),
    DEEPSEEK_KNOWN_MODELS,
  )
  assert.equal(
    fallbackModelsForDiscoveryError(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
      },
      new LlmHttpError('LLM_AUTH_INVALID', 401),
    ),
    null,
  )
  assert.equal(
    fallbackModelsForDiscoveryError(
      {
        provider: 'openai',
        baseUrl: 'https://api.deepseek.com',
      },
      new LlmHttpError('LLM_REQUEST_FAILED', 404),
    ),
    null,
  )
  assert.equal(
    fallbackModelsForDiscoveryError(
      {
        provider: 'deepseek',
        baseUrl: 'https://api.deepseek.com:8443',
      },
      new LlmHttpError('LLM_REQUEST_FAILED', 404),
    ),
    null,
  )
})

test('model discovery timeout is longer than the previous eight-second limit', () => {
  assert.equal(LLM_MODEL_DISCOVERY_TIMEOUT_MS, 15_000)
})

test('LLM JSON requests classify auth, rate limit, and malformed JSON without leaking secrets or response bodies', async () => {
  const cases = [
    {
      status: 401,
      body: '{"error":{"message":"secret upstream auth detail"}}',
      expected: 'LLM_AUTH_INVALID',
    },
    {
      status: 403,
      body: '{"error":{"message":"forbidden upstream detail"}}',
      expected: 'LLM_AUTH_INVALID',
    },
    {
      status: 429,
      body: '{"error":{"message":"quota detail"}}',
      expected: 'LLM_RATE_LIMITED',
    },
    {
      status: 200,
      body: '{"broken":',
      expected: 'LLM_RESPONSE_INVALID',
    },
  ] as const

  for (const item of cases) {
    const fixture = await listen((_request, response) => {
      response.statusCode = item.status
      response.setHeader('Content-Type', 'application/json')
      response.end(item.body)
    })
    try {
      await assert.rejects(
        requestLlmJson(new URL(`${fixture.baseUrl}/models`), {
          apiKey: 'never-echo-this-key',
          allowPrivateNetwork: true,
          maxResponseBytes: 1024,
          timeoutMs: 1_000,
        }),
        (error: unknown) => {
          assert.ok(error instanceof Error)
          assert.equal(error.message, item.expected)
          assert.equal(error.message.includes('never-echo-this-key'), false)
          assert.equal(error.message.includes('upstream detail'), false)
          return true
        },
      )
    } finally {
      await close(fixture.server)
    }
  }
})

test('server action error mapping provides specific localized discovery errors', () => {
  const cases = [
    ['LLM_AUTH_INVALID', 'err.llmModelsAuthInvalid'],
    ['LLM_RATE_LIMITED', 'err.llmModelsRateLimited'],
    ['LLM_TIMEOUT', 'err.llmModelsTimeout'],
    ['LLM_RESPONSE_INVALID', 'err.llmModelsResponseInvalid'],
  ] as const

  for (const [code, key] of cases) {
    assert.equal(llmDiscoveryErrorKey(new Error(code)), key)
    assert.ok(dictionaries.zh[key])
    assert.ok(dictionaries.en[key])
  }
  assert.equal(
    llmDiscoveryErrorKey(new Error('unknown upstream detail')),
    'err.llmModelsFailed',
  )
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
