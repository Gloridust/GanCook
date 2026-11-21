'use client'

import { useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { useLocale, useT } from '@/components/i18n-provider'
import { markPantryUsedUp, removePantryItem, savePantryItem } from '@/lib/actions/pantry'
import {
  PANTRY_UNITS_EN,
  PANTRY_UNITS_ZH,
  type PantryLocation,
} from '@/lib/pantry'
import type { PantryItem } from '@/lib/db/schema'
import { dayjs } from '@/lib/time'

/** 新增 / 编辑一条库存 */
export function PantryForm({
  item,
  open,
  onOpenChange,
  defaultLocation = 'fridge',
  today,
}: {
  item: PantryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultLocation?: PantryLocation
  /** 家庭时区下的今天 YYYY-MM-DD */
  today: string
}) {
  const t = useT()
  const locale = useLocale()
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : '')
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [location, setLocation] = useState<PantryLocation>(item?.location ?? defaultLocation)
  const [expiresOn, setExpiresOn] = useState(item?.expiresOn ?? '')
  const [note, setNote] = useState(item?.note ?? '')
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()
  const [deleting, startDeleting] = useTransition()
  const units = locale === 'zh' ? PANTRY_UNITS_ZH : PANTRY_UNITS_EN

  const save = () => {
    setError('')
    startSaving(async () => {
      const res = await savePantryItem(item?.id ?? null, {
        name,
        quantity,
        unit,
        location,
        expiresOn,
        note,
      })
      if (res.ok) onOpenChange(false)
      else setError(res.error)
    })
  }

  const usedUp = () => {
    if (!item) return
    startDeleting(async () => {
      const res = await markPantryUsedUp(item.id)
      if (res.ok) onOpenChange(false)
      else setError(res.error)
    })
  }

  const remove = () => {
    if (!item || !confirm(t('pantry.deleteConfirm', { name: item.name }))) return
    startDeleting(async () => {
      const res = await removePantryItem(item.id)
      if (res.ok) onOpenChange(false)
      else setError(res.error)
    })
  }

  const plusDays = (n: number) =>
    setExpiresOn(dayjs(today, 'YYYY-MM-DD').add(n, 'day').format('YYYY-MM-DD'))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={item ? t('pantry.edit') : t('pantry.add')}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <div>
            <Label htmlFor="pantry-name">{t('pantry.name')}</Label>
            <Input
              id="pantry-name"
              value={name}
              maxLength={30}
              autoFocus={!item}
              placeholder={t('pantry.namePh')}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="pantry-qty">{t('pantry.quantity')}</Label>
            <div className="flex gap-2">
              <Input
                id="pantry-qty"
                inputMode="decimal"
                className="w-28"
                value={quantity}
                placeholder={t('pantry.quantityPh')}
                onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <Input
                aria-label={t('pantry.unit')}
                className="flex-1"
                value={unit}
                maxLength={10}
                placeholder={t('pantry.unit')}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="mf-rail -mx-5 mt-2 px-5">
              {units.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`flex-none rounded-full px-3 py-1 text-sm ${
                    unit === u ? 'bg-tint font-medium text-accent' : 'bg-trough text-secondary'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{t('pantry.location')}</Label>
            <Segmented
              value={location}
              onChange={setLocation}
              layoutId="pantry-location"
              options={[
                { value: 'fridge', label: t('pantry.loc.fridge') },
                { value: 'freezer', label: t('pantry.loc.freezer') },
                { value: 'pantry', label: t('pantry.loc.pantry') },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="pantry-exp">{t('pantry.expiresOn')}</Label>
            <Input
              id="pantry-exp"
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {[3, 7, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => plusDays(n)}
                  className="rounded-full bg-trough px-3 py-1 text-sm text-secondary"
                >
                  {t('pantry.plusDays', { n })}
                </button>
              ))}
              {expiresOn && (
                <button
                  type="button"
                  onClick={() => setExpiresOn('')}
                  className="rounded-full px-3 py-1 text-sm text-secondary underline-offset-2 hover:underline"
                >
                  {t('pantry.noExpiry')}
                </button>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="pantry-note">{t('pantry.note')}</Label>
            <Input
              id="pantry-note"
              value={note}
              maxLength={100}
              placeholder={t('pantry.notePh')}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2">
            {item && (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                loading={deleting}
                onClick={remove}
                aria-label={t('common.delete')}
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            {item && item.quantity !== 0 && (
              <Button type="button" variant="secondary" loading={deleting} onClick={usedUp}>
                {t('pantry.usedUp')}
              </Button>
            )}
            <Button type="submit" className="flex-1" loading={saving}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
