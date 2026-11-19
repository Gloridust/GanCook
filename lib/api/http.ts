import 'server-only'
import type { User } from '@/lib/db/schema'
import { userFromRequest } from './tokens'

/** 开放 API 的统一响应格式：成功 { data }，失败 { error: { code, message } } */
const MESSAGES: Record<string, string> = {
  unauthorized: 'Missing or invalid API token',
  notFound: 'Not found',
  badJson: 'Request body must be a JSON object',
  mealNotFound: 'Meal not found',
  dishNotFound: 'Dish not found',
  orderClosed: 'Ordering is closed for this meal',
  dateFmt: 'date must be YYYY-MM-DD',
  timeFmt: 'time must be HH:MM',
  mealType: 'mealType must be breakfast, lunch or dinner',
  dishNameRequired: 'name is required',
  dishNameTooLong: 'name must be at most 30 characters',
  onlyOwnerDishEdit: 'Only the creator or an admin can edit this dish',
  onlyOwnerDishDel: 'Only the creator or an admin can delete this dish',
  statusInvalid: 'status must be active or archived',
  imageFetch: 'Could not download imageUrl',
  saveFailed: 'Save failed',
  internal: 'Internal server error',
  nameRequired: 'name is required',
  nameTooLong: 'name must be at most 30 characters',
  quantityInvalid: 'quantity must be a number between 0 and 99999',
  dateInvalid: 'expiresOn must be a valid YYYY-MM-DD date',
  locationInvalid: 'location must be fridge, freezer or pantry',
  quantityRequired: 'quantity is required',
}

const STATUS: Record<string, number> = {
  unauthorized: 401,
  notFound: 404,
  mealNotFound: 404,
  dishNotFound: 404,
  orderClosed: 409,
  onlyOwnerDishEdit: 403,
  onlyOwnerDishDel: 403,
  imageFetch: 422,
  saveFailed: 500,
}

const NO_STORE = { 'Cache-Control': 'no-store' }

export function ok(data: unknown, status = 200): Response {
  return Response.json({ data }, { status, headers: NO_STORE })
}

export function fail(code: string, status?: number): Response {
  return Response.json(
    { error: { code, message: MESSAGES[code] ?? code } },
    { status: status ?? STATUS[code] ?? 400, headers: NO_STORE },
  )
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

type Ctx<P> = { params: Promise<P> }

/** 包一层令牌鉴权 */
export function withApi<P = Record<string, never>>(
  handler: (req: Request, user: User, params: P) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx<P>) => {
    const user = userFromRequest(req)
    if (!user) return fail('unauthorized')
    try {
      return await handler(req, user, await ctx.params)
    } catch (e) {
      console.error('[api] error', e)
      return fail('internal', 500)
    }
  }
}
