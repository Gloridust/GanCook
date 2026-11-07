import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractRecipeFromHtml,
  htmlToVisibleText,
} from '../lib/recipe/parse'
import { extractXiaohongshuRecipeFromHtml } from '../lib/recipe/xiaohongshu'
import { findElements, stripNonVisibleBlocks } from '../lib/recipe/html-scan'
import { assertSafeRemoteUrl } from '../lib/recipe/ssrf'

const MB3 = 3 * 1024 * 1024

// 回归：未闭合标签曾让正则退化为 O(n²)，一个 150KB 页面即可卡死事件循环数秒
for (const unit of ['<!--', '<svg', '<script', '<meta ', '<title', '<style x', '<']) {
  test(`parsers stay linear on unclosed "${unit}" payload (3MB)`, () => {
    const html = unit.repeat(Math.ceil(MB3 / unit.length))
    const start = performance.now()
    extractRecipeFromHtml(html, 'https://recipes.example/a')
    htmlToVisibleText(html)
    extractXiaohongshuRecipeFromHtml(html, 'https://www.xiaohongshu.com/explore/1')
    const ms = performance.now() - start
    assert.ok(ms < 2_000, `took ${ms.toFixed(0)}ms`)
  })
}

test('out-of-range numeric entities do not throw', () => {
  const draft = extractRecipeFromHtml(
    '<title>&#99999999;红烧肉&#x110000;</title>',
    'https://recipes.example/a',
  )
  assert.match(draft.name, /红烧肉/)
})

test('findElements extracts json-ld and tolerates unclosed tail', () => {
  const html =
    '<script type="application/ld+json">{"a":1}</script><SCRIPT>x</SCRIPT><script>never closed'
  const els = findElements(html, 'script')
  assert.equal(els.length, 2)
  assert.equal(els[0].inner, '{"a":1}')
  assert.equal(els[1].inner, 'x')
  // <scripts> 之类的前缀不应误匹配
  assert.equal(findElements('<scripts>a</scripts>', 'script').length, 0)
})

test('stripNonVisibleBlocks removes comments and script/style blocks', () => {
  const out = stripNonVisibleBlocks(
    'a<!-- c -->b<script>var x="<p>"</script>c<style>p{}</style>d<svg><g/></svg>e<p>f</p>',
  )
  assert.equal(out.replace(/\s+/g, ''), 'abcde<p>f</p>')
})

test('JSON-LD recipe is still extracted', () => {
  const draft = extractRecipeFromHtml(
    `<html><head><script type='application/ld+json'>${JSON.stringify({
      '@type': 'Recipe',
      name: '番茄炒蛋',
      recipeInstructions: ['打蛋', '炒番茄'],
    })}</script></head></html>`,
    'https://recipes.example/a',
  )
  assert.equal(draft.name, '番茄炒蛋')
  assert.match(draft.instructions, /打蛋/)
})

test('assertSafeRemoteUrl blocks IPv4-compatible, NAT64 and site-local IPv6', () => {
  for (const value of [
    'http://[::127.0.0.1]/',
    'http://[64:ff9b::7f00:1]/',
    'http://[fec0::1]/',
  ]) {
    assert.throws(() => assertSafeRemoteUrl(value), /UNSAFE_URL/, value)
  }
})
