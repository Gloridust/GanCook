/**
 * 推送消息的文案与各渠道请求体（纯函数，便于测试）。
 */
import type { NotifyChannelType, NotifyEvent } from './events'

export type NotifyLocale = 'zh' | 'en'

export type NotifyMeal = {
  id: string
  title: string | null
  mealType: 'breakfast' | 'lunch' | 'dinner'
  date: string
  /** 已按家庭时区格式化的 HH:mm */
  diningTime: string
  deadline: string
  /** 截止还剩多少分钟（deadline_soon 用） */
  minutesLeft?: number
}

export type NotifyDish = { name: string; total: number; people: string[] }

export type NotifyContext = {
  locale: NotifyLocale
  familyName: string
  meal: NotifyMeal
  dishes: NotifyDish[]
  cookName: string | null
  /** 饭局详情的完整链接（配置了外网地址时） */
  link: string | null
}

export type NotifyMessage = { title: string; text: string; link: string | null }

const MEAL = {
  zh: { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' },
  en: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' },
}

function mealName(ctx: NotifyContext): string {
  const m = ctx.meal
  const kind = MEAL[ctx.locale][m.mealType]
  const md = m.date.slice(5).replace('-', '/')
  return m.title ? `${m.title}（${md} ${kind}）` : `${md} ${kind}`
}

function dishLines(ctx: NotifyContext): string[] {
  return ctx.dishes.map((d) => {
    const who = d.people.length ? `（${d.people.join(ctx.locale === 'zh' ? '、' : ', ')}）` : ''
    return `· ${d.name} ×${d.total}${who}`
  })
}

export function buildMessage(event: NotifyEvent | 'test', ctx: NotifyContext): NotifyMessage {
  const zh = ctx.locale === 'zh'
  const name = mealName(ctx)
  const lines: string[] = []
  let title: string

  switch (event) {
    case 'meal_created':
      title = zh ? `🍽️ 开始点菜：${name}` : `🍽️ Ordering open: ${name}`
      lines.push(
        zh
          ? `${ctx.meal.diningTime} 开饭，${ctx.meal.deadline} 截止点菜，想吃什么快来点～`
          : `Served at ${ctx.meal.diningTime}; ordering closes at ${ctx.meal.deadline}.`,
      )
      break
    case 'deadline_soon':
      title = zh ? `⏰ 快截止了：${name}` : `⏰ Closing soon: ${name}`
      lines.push(
        zh
          ? `还有 ${ctx.meal.minutesLeft ?? '?'} 分钟截止点菜（${ctx.meal.deadline}）。`
          : `Ordering closes in ${ctx.meal.minutesLeft ?? '?'} min (${ctx.meal.deadline}).`,
      )
      if (ctx.dishes.length > 0) {
        lines.push(zh ? '目前点了：' : 'Ordered so far:', ...dishLines(ctx))
      } else {
        lines.push(zh ? '还没人点菜哦。' : 'Nobody has ordered yet.')
      }
      break
    case 'cooking':
      title = zh ? `👩‍🍳 点菜结束：${name}` : `👩‍🍳 Orders are in: ${name}`
      lines.push(
        ctx.cookName
          ? zh
            ? `掌勺：${ctx.cookName}，${ctx.meal.diningTime} 开饭。要做这些：`
            : `${ctx.cookName} is cooking, served at ${ctx.meal.diningTime}. The menu:`
          : zh
            ? `${ctx.meal.diningTime} 开饭，还没人认领掌勺。要做这些：`
            : `Served at ${ctx.meal.diningTime}; nobody has claimed the cooking yet. The menu:`,
        ...dishLines(ctx),
      )
      break
    default:
      title = zh ? '✅ 干饭厨子推送测试' : '✅ GanCook test notification'
      lines.push(
        zh
          ? `「${ctx.familyName}」的推送已接通，开局、截止前、点菜结束时会在这里提醒。`
          : `Notifications for "${ctx.familyName}" are working.`,
      )
  }
  if (ctx.link) lines.push('', ctx.link)
  return { title, text: lines.join('\n'), link: ctx.link }
}

export type NotifyRequest = {
  url: string
  body: string
  headers: Record<string, string>
}

/** 各渠道的请求体 */
export function buildRequest(
  type: NotifyChannelType,
  url: string,
  msg: NotifyMessage,
  event: NotifyEvent | 'test',
  ctx: NotifyContext,
): NotifyRequest {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' }
  const full = `${msg.title}\n${msg.text}`
  let body: unknown
  switch (type) {
    case 'wecom':
      // 企业微信群机器人：用 text 而非 markdown，各客户端都能正常显示
      body = { msgtype: 'text', text: { content: full } }
      break
    case 'dingtalk':
      body = { msgtype: 'text', text: { content: full } }
      break
    case 'feishu':
      body = { msg_type: 'text', content: { text: full } }
      break
    case 'bark': {
      // Bark：POST https://api.day.app/<key>（自建服务同理）
      const b: Record<string, string> = {
        title: msg.title,
        body: msg.text,
        group: 'GanCook',
      }
      if (msg.link) b.url = msg.link
      body = b
      break
    }
    default:
      body = {
        event,
        title: msg.title,
        text: msg.text,
        link: msg.link,
        family: ctx.familyName,
        meal: ctx.meal,
        cook: ctx.cookName,
        dishes: ctx.dishes,
      }
  }
  return { url, body: JSON.stringify(body), headers }
}

/** 机器人类渠道 HTTP 200 也可能失败（errcode / code 非 0），据此判断 */
export function responseError(type: NotifyChannelType, text: string): string | null {
  if (type !== 'wecom' && type !== 'dingtalk' && type !== 'feishu') return null
  try {
    const j = JSON.parse(text) as Record<string, unknown>
    const code = j.errcode ?? j.code ?? j.StatusCode ?? 0
    if (code === 0 || code === '0') return null
    return String(j.errmsg ?? j.msg ?? `code ${String(code)}`)
  } catch {
    return null
  }
}

/** 渠道地址校验：仅 http(s)，且不能带账号密码 */
export function validChannelUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    return u.toString()
  } catch {
    return null
  }
}
