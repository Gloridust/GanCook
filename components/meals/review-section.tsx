'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Avatar } from '@/components/ui/avatar'
import { Stars } from '@/components/ui/stars'
import { Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { submitReview } from '@/lib/actions/reviews'
import type { ReviewDetail } from '@/lib/meals'

export function ReviewSection({
  mealId,
  reviews,
  meId,
}: {
  mealId: string
  reviews: ReviewDetail[]
  meId: string
}) {
  const router = useRouter()
  const t = useT()
  const mine = reviews.find((r) => r.userId === meId)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const others = reviews.filter((r) => r.userId !== meId)
  const avg =
    reviews.length > 0
      ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
      : null

  const submit = () => {
    setMsg('')
    if (rating < 1) return setMsg(t('review.needStar'))
    startTransition(async () => {
      const res = await submitReview(mealId, { rating, comment })
      if (res.ok) {
        setMsg(t('review.submitted'))
        router.refresh()
      } else setMsg(res.error)
    })
  }

  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink">
        {t('review.title')}
        {avg && (
          <span className="text-sm font-normal text-[#b3791f]">
            {t('review.avg', { n: avg })}
          </span>
        )}
      </h2>

      {/* 我的评价 */}
      <div className="mf-raised p-4">
        <div className="relative flex items-center justify-between">
          <span className="text-sm text-secondary">
            {mine ? t('review.editMine') : t('review.mine')}
          </span>
          <Stars value={rating} onChange={setRating} />
        </div>
        <Textarea
          className="relative mt-3"
          placeholder={t('review.commentPh')}
          value={comment}
          maxLength={200}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="relative mt-3 flex items-center gap-3">
          <Button size="sm" loading={pending} onClick={submit}>
            {mine ? t('review.update') : t('review.submit')}
          </Button>
          {msg && <span className="text-sm text-accent">{msg}</span>}
        </div>
      </div>

      {/* 其他人的评价 */}
      {others.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {others.map((r) => (
            <div key={r.id} className="mf-raised flex gap-3 p-3">
              <Avatar
                name={r.userName}
                src={r.userAvatar ? `/api/uploads/${r.userAvatar}` : null}
                size={36}
              />
              <div className="relative min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink">
                    {r.userName}
                  </span>
                  <Stars value={r.rating} size={14} />
                </div>
                {r.comment && (
                  <p className="mt-0.5 text-sm text-secondary">{r.comment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
