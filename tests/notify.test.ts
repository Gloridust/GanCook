import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BOT_SIGNATURE,
  buildMessage,
  buildRequest,
  responseError,
  validChannelUrl,
  type NotifyContext,
} from '../lib/notify/format'

const ctx: NotifyContext = {
  locale: 'zh',
  familyName: '我家',
  meal: {
    id: 'm1',
    title: null,
    mealType: 'dinner',
    date: '2026-11-20',
    diningTime: '18:30',
    deadline: '16:30',
    minutesLeft: 25,
  },
  dishes: [{ name: '红烧肉', total: 3, people: ['爸爸', '妈妈×2'] }],
  cookName: '奶奶',
  link: 'https://cook.example.com/meals/m1',
}

test('cooking message lists the menu and the cook', () => {
  const msg = buildMessage('cooking', ctx)
  assert.match(msg.title, /点菜结束/)
  assert.match(msg.text, /掌勺：奶奶/)
  assert.match(msg.text, /红烧肉 ×3（爸爸、妈妈×2）/)
  assert.match(msg.text, /cook\.example\.com\/meals\/m1$/)
})

test('deadline message says how long is left', () => {
  const msg = buildMessage('deadline_soon', { ...ctx, dishes: [], locale: 'en' })
  assert.match(msg.text, /closes in 25 min/)
  assert.match(msg.text, /Nobody has ordered/)
})

test('channel payloads match each provider format', () => {
  const msg = buildMessage('meal_created', ctx)
  const wecom = JSON.parse(buildRequest('wecom', 'https://x', msg, 'meal_created', ctx).body)
  assert.equal(wecom.msgtype, 'text')
  assert.ok(wecom.text.content.startsWith(msg.title))
  const feishu = JSON.parse(buildRequest('feishu', 'https://x', msg, 'meal_created', ctx).body)
  assert.equal(feishu.msg_type, 'text')
  const bark = JSON.parse(buildRequest('bark', 'https://x', msg, 'meal_created', ctx).body)
  assert.equal(bark.url, ctx.link)
  assert.equal(bark.group, 'GanCook')
  const hook = JSON.parse(buildRequest('webhook', 'https://x', msg, 'meal_created', ctx).body)
  assert.equal(hook.event, 'meal_created')
  assert.equal(hook.meal.id, 'm1')
})

test('bot responses with non-zero codes count as failures', () => {
  assert.equal(responseError('wecom', '{"errcode":0,"errmsg":"ok"}'), null)
  assert.equal(responseError('wecom', '{"errcode":93000,"errmsg":"invalid webhook url"}'), 'invalid webhook url')
  assert.equal(responseError('feishu', '{"code":19021,"msg":"sign match fail"}'), 'sign match fail')
  assert.equal(responseError('bark', 'anything'), null)
})

test('channel URLs must be plain http(s)', () => {
  assert.ok(validChannelUrl(' https://api.day.app/abc '))
  assert.equal(validChannelUrl('ftp://x'), null)
  assert.equal(validChannelUrl('https://user:pw@x.com'), null)
  assert.equal(validChannelUrl('not a url'), null)
})

test('every bot message carries the 干饭 keyword so DingTalk/Feishu keyword security passes', () => {
  for (const event of ['meal_created', 'deadline_soon', 'cooking', 'test'] as const) {
    for (const locale of ['zh', 'en'] as const) {
      const c = { ...ctx, locale }
      const msg = buildMessage(event, c)
      for (const type of ['wecom', 'dingtalk', 'feishu'] as const) {
        const body = JSON.parse(buildRequest(type, 'https://x', msg, event, c).body)
        const text: string = body.text?.content ?? body.content?.text
        assert.ok(text.includes('干饭'), `${type}/${event}/${locale} lacks keyword`)
        assert.ok(text.endsWith(BOT_SIGNATURE))
      }
    }
  }
})
