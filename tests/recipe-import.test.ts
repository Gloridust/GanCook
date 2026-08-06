import assert from 'node:assert/strict'
import test from 'node:test'
import { extractHttpUrl } from '../lib/recipe/url'
import {
  extractRecipeFromHtml,
  isUsableRecipeDraft,
  mergeRecipeDrafts,
  parseRecipeJsonLd,
} from '../lib/recipe/parse'
import {
  assertSafeRemoteUrl,
  isPublicIpAddress,
  selectPublicAddress,
} from '../lib/recipe/ssrf'
import { parseLlmRecipeOutput } from '../lib/recipe/llm'
import {
  createImportImageToken,
  verifyImportImageToken,
} from '../lib/recipe/image-token'

test('extractHttpUrl finds an HTTP URL inside share text and trims punctuation', () => {
  assert.equal(
    extractHttpUrl(
      '我在下厨房发现一道好菜，分享给你：https://www.xiachufang.com/recipe/12345/，打开看看！',
    ),
    'https://m.xiachufang.com/recipe/12345/',
  )
  assert.equal(extractHttpUrl('ftp://example.com/recipe'), null)
})

test('extractHttpUrl uses the parseable mobile host for Xiachufang recipes', () => {
  assert.equal(
    extractHttpUrl('https://www.xiachufang.com/recipe/1012917/'),
    'https://m.xiachufang.com/recipe/1012917/',
  )
})

test('parseRecipeJsonLd extracts nested Recipe instructions, tags, and image', () => {
  const recipe = parseRecipeJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Recipe',
        name: '番茄炒蛋',
        description: '酸甜家常菜',
        keywords: '家常, 快手',
        recipeCategory: ['晚餐'],
        image: [{ '@type': 'ImageObject', url: 'https://img.example/dish.jpg' }],
        recipeInstructions: [
          { '@type': 'HowToStep', text: '鸡蛋炒熟盛出。' },
          {
            '@type': 'HowToSection',
            name: '炒制',
            itemListElement: [
              { '@type': 'HowToStep', text: '番茄炒软。' },
              { '@type': 'HowToStep', text: '倒回鸡蛋调味。' },
            ],
          },
        ],
      },
    ],
  })

  assert.deepEqual(recipe, {
    name: '番茄炒蛋',
    description: '酸甜家常菜',
    instructions: '1. 鸡蛋炒熟盛出。\n2. 炒制：番茄炒软。\n3. 炒制：倒回鸡蛋调味。',
    tags: ['家常', '快手', '晚餐'],
    imageUrl: 'https://img.example/dish.jpg',
  })
})

test('extractRecipeFromHtml prefers JSON-LD Recipe and supports OpenGraph fallback', () => {
  const jsonLdHtml = `
    <html><head>
      <meta property="og:title" content="错误标题">
      <script type="application/ld+json">
        {"@type":"Recipe","name":"葱油拌面","recipeInstructions":"煮面。\\n拌入葱油。","image":"https://img.example/noodles.jpg"}
      </script>
    </head></html>`
  assert.equal(extractRecipeFromHtml(jsonLdHtml, 'https://example.com').name, '葱油拌面')

  const ogHtml = `
    <html><head>
      <meta property="og:title" content="红烧肉的做法">
      <meta property="og:description" content="先焯水，再小火慢炖。">
      <meta property="og:image" content="/cover.jpg">
    </head></html>`
  assert.deepEqual(extractRecipeFromHtml(ogHtml, 'https://food.example/recipe/1'), {
    name: '红烧肉',
    description: '先焯水，再小火慢炖。',
    instructions: '',
    tags: [],
    imageUrl: 'https://food.example/cover.jpg',
  })
})

test('extractRecipeFromHtml parses Xiachufang-style JSON-LD markup', () => {
  const html = `
    <title data-n-head="true">【步骤图】葱油拌面的做法_菜谱_下厨房</title>
    <script data-n-head="true" data-hid="ldjson" type="application/ld+json" data-body="true">
      {
        "@context":"https://schema.org/",
        "@type":"Recipe",
        "name":"葱油拌面",
        "description":"简单快手",
        "recipeInstructions":"熬葱油。\\n煮面后拌匀。",
        "keywords":["葱油拌面的做法","家常"],
        "image":"https://i2.chuimg.com/cover.jpg"
      }
    </script>`
  const recipe = extractRecipeFromHtml(
    html,
    'https://m.xiachufang.com/recipe/123/',
  )
  assert.equal(recipe.name, '葱油拌面')
  assert.equal(recipe.instructions, '熬葱油。\n煮面后拌匀。')
  assert.equal(recipe.imageUrl, 'https://i2.chuimg.com/cover.jpg')
  assert.deepEqual(recipe.tags, ['家常'])
})

test('extractRecipeFromHtml normalizes Xiachufang numbered comma-separated steps', () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context":"https://schema.org/",
        "@type":"Recipe",
        "name":"番茄炒蛋",
        "recipeInstructions":"0.鸡蛋加盐打匀,1.番茄切块,2.炒熟后盛盘"
      }
    </script>`

  assert.equal(
    extractRecipeFromHtml(html, 'https://m.xiachufang.com/recipe/1012917/')
      .instructions,
    '1. 鸡蛋加盐打匀\n2. 番茄切块\n3. 炒熟后盛盘',
  )
})

test('extractRecipeFromHtml parses JSON-LD before decoding HTML entities', () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type":"Recipe",
        "name":"Fish &amp; Chips",
        "description":"Use &quot;high&quot; heat",
        "recipeInstructions":"Fry until crisp."
      }
    </script>`

  assert.deepEqual(extractRecipeFromHtml(html, 'https://food.example/recipe'), {
    name: 'Fish & Chips',
    description: 'Use "high" heat',
    instructions: 'Fry until crisp.',
    tags: [],
    imageUrl: null,
  })
})

test('parseRecipeJsonLd selects the most complete Recipe candidate', () => {
  const recipe = parseRecipeJsonLd({
    '@graph': [
      { '@type': 'Recipe', name: '导航卡片' },
      {
        '@type': 'https://schema.org/Recipe',
        name: '完整菜谱',
        description: '可执行的菜谱',
        recipeInstructions: ['备料', '烹饪'],
      },
    ],
  })

  assert.equal(recipe?.name, '完整菜谱')
  assert.equal(recipe?.instructions, '1. 备料\n2. 烹饪')
})

test('recipe drafts require meaningful recipe content, not a challenge-page title', () => {
  assert.equal(
    isUsableRecipeDraft({
      name: '滑动验证',
      description: '',
      instructions: '',
      tags: [],
      imageUrl: null,
    }),
    false,
  )
  assert.equal(
    isUsableRecipeDraft({
      name: '红烧肉',
      description: '先焯水，再慢炖。',
      instructions: '',
      tags: [],
      imageUrl: null,
    }),
    true,
  )
})

test('mergeRecipeDrafts preserves structured fields and only fills missing values', () => {
  assert.deepEqual(
    mergeRecipeDrafts(
      {
        name: '结构化菜名',
        description: '',
        instructions: '结构化步骤',
        tags: ['家常'],
        imageUrl: null,
      },
      {
        name: 'LLM 菜名',
        description: 'LLM 简介',
        instructions: 'LLM 步骤',
        tags: ['下饭', '家常'],
        imageUrl: 'https://img.example/cover.jpg',
      },
    ),
    {
      name: '结构化菜名',
      description: 'LLM 简介',
      instructions: '结构化步骤',
      tags: ['家常', '下饭'],
      imageUrl: 'https://img.example/cover.jpg',
    },
  )
})

test('assertSafeRemoteUrl rejects unsafe schemes, credentials, and local hosts', () => {
  for (const value of [
    'file:///etc/passwd',
    'https://user:pass@example.com/a',
    'http://localhost/a',
    'http://api.internal/a',
    'http://127.0.0.1/a',
    'http://[::1]/a',
  ]) {
    assert.throws(() => assertSafeRemoteUrl(value), /UNSAFE_URL/, value)
  }
  assert.equal(
    assertSafeRemoteUrl('https://recipes.example/path').hostname,
    'recipes.example',
  )
})

test('isPublicIpAddress rejects local, private, link-local, carrier, and reserved ranges', () => {
  const rejected = [
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.1.1',
    '192.0.2.1',
    '198.18.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '224.0.0.1',
    '::',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    '::ffff:192.168.1.1',
  ]
  for (const address of rejected) {
    assert.equal(isPublicIpAddress(address), false, address)
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true)
  assert.equal(isPublicIpAddress('1.1.1.1'), true)
  assert.equal(isPublicIpAddress('2606:4700:4700::1111'), true)
})

test('DNS pinning rejects a hostname when any resolved address is non-public', () => {
  assert.throws(
    () =>
      selectPublicAddress([
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]),
    /UNSAFE_URL/,
  )
  assert.deepEqual(
    selectPublicAddress([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]),
    { address: '93.184.216.34', family: 4 },
  )
})

test('parseLlmRecipeOutput accepts fenced JSON and normalizes validated fields', () => {
  assert.deepEqual(
    parseLlmRecipeOutput(`
      \`\`\`json
      {
        "name": "  鱼香茄子  ",
        "description": "下饭菜",
        "instructions": ["茄子切条。", "炒香料汁。"],
        "tags": ["川菜", "下饭", "川菜"],
        "imageUrl": "https://img.example/a.jpg"
      }
      \`\`\`
    `),
    {
      name: '鱼香茄子',
      description: '下饭菜',
      instructions: '1. 茄子切条。\n2. 炒香料汁。',
      tags: ['川菜', '下饭'],
      imageUrl: 'https://img.example/a.jpg',
    },
  )
})

test('parseLlmRecipeOutput rejects missing core fields and unsafe image URLs', () => {
  assert.throws(() =>
    parseLlmRecipeOutput('{"name":"菜","instructions":"","imageUrl":null}'),
  )
  assert.throws(() =>
    parseLlmRecipeOutput(
      '{"name":"菜","instructions":"做熟","imageUrl":"file:///etc/passwd"}',
    ),
  )
})

test('import image tokens are user-bound, path-constrained, and expiring', () => {
  const token = createImportImageToken(
    {
      userId: 'user-1',
      path: 'imports/123e4567-e89b-12d3-a456-426614174000.webp',
      expiresAt: 2_000,
    },
    'test-secret',
  )
  assert.deepEqual(verifyImportImageToken(token, 'user-1', 'test-secret', 1_000), {
    userId: 'user-1',
    path: 'imports/123e4567-e89b-12d3-a456-426614174000.webp',
    expiresAt: 2_000,
  })
  assert.throws(() =>
    verifyImportImageToken(token, 'user-2', 'test-secret', 1_000),
  )
  assert.throws(() =>
    verifyImportImageToken(token, 'user-1', 'test-secret', 2_001),
  )
  assert.throws(() =>
    createImportImageToken(
      { userId: 'user-1', path: '../secret', expiresAt: 2_000 },
      'test-secret',
    ),
  )
})
