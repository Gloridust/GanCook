import { fail, ok, withApi } from '@/lib/api/http'
import { mealDetailOut } from '@/lib/api/serialize'
import { getMealDetail } from '@/lib/meals'

export const dynamic = 'force-dynamic'

/** 饭局详情：含按菜聚合的「谁点了几份」和评价 */
export const GET = withApi<{ id: string }>((_req, _user, { id }) => {
  const detail = getMealDetail(id)
  return detail ? ok(mealDetailOut(detail)) : fail('mealNotFound')
})
