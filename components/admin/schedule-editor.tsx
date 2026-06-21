'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { MEAL_EMOJI } from '@/lib/time'
import { useT } from '@/components/i18n-provider'
import {
  updateSchedule,
  createSchedule,
  deleteSchedule,
} from '@/lib/actions/admin'
import type { MealSchedule } from '@/lib/db/schema'

type MealType = 'breakfast' | 'lunch' | 'dinner'

function ScheduleRow({ s }: { s: MealSchedule }) {
  const t = useT()
  const router = useRouter()
  const WEEK = [
    t('week.sun'),
    t('week.mon'),
    t('week.tue'),
    t('week.wed'),
    t('week.thu'),
    t('week.fri'),
    t('week.sat'),
  ]
  const [name, setName] = useState(s.name)
  const [mealType, setMealType] = useState<MealType>(s.mealType)
  const [enabled, setEnabled] = useState(s.enabled)
  const [diningTime, setDiningTime] = useState(s.diningTime)
  const [createLead, setCreateLead] = useState(String(s.createLeadHours))
  const [deadlineLead, setDeadlineLead] = useState(
    String(s.deadlineLeadMinutes),
  )
  const [weekdays, setWeekdays] = useState<number[]>(s.weekdays)
  const [msg, setMsg] = useState('')
  const [pending, startTransition] = useTransition()

  const toggleDay = (d: number) =>
    setWeekdays((w) =>
      w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort(),
    )

  const save = () => {
    setMsg('')
    startTransition(async () => {
      const res = await updateSchedule(s.id, {
        name,
        mealType,
        enabled,
        diningTime,
        createLeadHours: Number(createLead) || 0,
        deadlineLeadMinutes: Number(deadlineLead) || 0,
        weekdays,
      })
      setMsg(res.ok ? t('common.saved') : res.error)
    })
  }

  const remove = () => {
    if (!confirm(t('schedule.deleteConfirm'))) return
    startTransition(async () => {
      await deleteSchedule(s.id)
      router.refresh()
    })
  }

  return (
    <div className="mf-raised space-y-3 p-4">
      <div className="relative flex items-center gap-2">
        <span className="text-xl">{MEAL_EMOJI[mealType]}</span>
        <Input
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          className="h-9 flex-1 font-semibold"
        />
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <div
        className={cn(
          'space-y-3',
          !enabled && 'pointer-events-none opacity-50',
        )}
      >
        <Segmented<MealType>
          value={mealType}
          onChange={setMealType}
          layoutId={`stype-${s.id}`}
          options={[
            { value: 'breakfast', label: t('meal.breakfast') },
            { value: 'lunch', label: t('meal.lunch') },
            { value: 'dinner', label: t('meal.dinner') },
          ]}
        />
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 text-secondary">{t('schedule.diningTime')}</span>
          <Input
            type="time"
            value={diningTime}
            onChange={(e) => setDiningTime(e.target.value)}
            className="h-9 flex-1"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 text-secondary">{t('schedule.openLead')}</span>
          <Input
            type="number"
            value={createLead}
            onChange={(e) => setCreateLead(e.target.value)}
            className="h-9 w-20"
          />
          <span className="text-secondary">{t('schedule.hoursBefore')}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 text-secondary">{t('schedule.deadline')}</span>
          <Input
            type="number"
            value={deadlineLead}
            onChange={(e) => setDeadlineLead(e.target.value)}
            className="h-9 w-20"
          />
          <span className="text-secondary">{t('schedule.minutesBefore')}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WEEK.map((label, d) => {
            const on = weekdays.includes(d)
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={cn(
                  'h-8 w-8 rounded-full text-sm font-medium',
                  on ? 'mf-accent-fill' : 'mf-inset text-secondary',
                )}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative flex items-center gap-3">
        <Button size="sm" loading={pending} onClick={save}>
          {t('common.save')}
        </Button>
        <button
          onClick={remove}
          disabled={pending}
          className="ml-auto flex items-center gap-1 text-sm text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          {t('common.delete')}
        </button>
        {msg && <span className="text-sm text-accent">{msg}</span>}
      </div>
    </div>
  )
}

export function ScheduleEditor({ schedules }: { schedules: MealSchedule[] }) {
  const t = useT()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const add = () =>
    startTransition(async () => {
      await createSchedule()
      router.refresh()
    })

  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <ScheduleRow key={s.id} s={s} />
      ))}
      <Button
        variant="trough"
        className="w-full"
        loading={pending}
        onClick={add}
      >
        <Plus className="h-4 w-4" />
        {t('schedule.add')}
      </Button>
    </div>
  )
}
