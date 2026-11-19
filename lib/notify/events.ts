/** 推送事件（纯常量，服务端 / 客户端 / schema 共用） */
export const NOTIFY_EVENTS = ['meal_created', 'deadline_soon', 'cooking'] as const
export type NotifyEvent = (typeof NOTIFY_EVENTS)[number]

export const NOTIFY_CHANNEL_TYPES = [
  'wecom',
  'feishu',
  'dingtalk',
  'bark',
  'webhook',
] as const
export type NotifyChannelType = (typeof NOTIFY_CHANNEL_TYPES)[number]
