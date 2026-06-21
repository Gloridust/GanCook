'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2, Archive, ArchiveRestore } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/client/compress-image'
import {
  createDish,
  updateDish,
  deleteDish,
  setDishStatus,
} from '@/lib/actions/dishes'
import type { Dish } from '@/lib/db/schema'

export function DishForm({
  mode,
  dish,
  children,
}: {
  mode: 'create' | 'edit'
  dish?: Dish
  children: React.ReactNode
}) {
  const router = useRouter()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(dish?.name ?? '')
  const [description, setDescription] = useState(dish?.description ?? '')
  const [tags, setTags] = useState((dish?.tags ?? []).join(' '))
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(
    dish?.imagePath ? `/api/uploads/${dish.imagePath}` : null,
  )
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const compressed = await compressImage(f)
    setBlob(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  const submit = () => {
    setError('')
    if (!name.trim()) return setError(t('err.dishNameRequired'))
    const form = new FormData()
    form.set('name', name)
    form.set('description', description)
    form.set('tags', tags)
    if (blob) form.set('image', blob, 'dish.jpg')
    startTransition(async () => {
      const res =
        mode === 'create'
          ? await createDish(form)
          : await updateDish(dish!.id, form)
      if (res.ok) {
        setOpen(false)
        if (mode === 'create') {
          setName('')
          setDescription('')
          setTags('')
          setBlob(null)
          setPreview(null)
        }
        router.refresh()
      } else {
        setError(res.error)
      }
    })
  }

  const runStatus = (status: 'active' | 'archived') =>
    startTransition(async () => {
      await setDishStatus(dish!.id, status)
      setOpen(false)
      router.refresh()
    })

  const runDelete = () =>
    startTransition(async () => {
      await deleteDish(dish!.id)
      setOpen(false)
      router.refresh()
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={mode === 'create' ? t('dishform.addTitle') : t('dishform.editTitle')}
      >
        <div className="space-y-4">
          {/* 图片 */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl mf-inset"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="预览"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex flex-col items-center gap-1.5 text-secondary">
                <ImagePlus className="h-7 w-7" />
                <span className="text-sm">{t('dishform.photo')}</span>
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pick}
          />

          <div>
            <Label htmlFor="dish-name">{t('dishform.name')}</Label>
            <Input
              id="dish-name"
              placeholder={t('dishform.namePh')}
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dish-desc">{t('dishform.note')}</Label>
            <Textarea
              id="dish-desc"
              placeholder={t('dishform.notePh')}
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="dish-tags">{t('dishform.tags')}</Label>
            <Input
              id="dish-tags"
              placeholder={t('dishform.tagsPh')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button className="w-full" size="lg" loading={pending} onClick={submit}>
            {mode === 'create' ? t('common.add') : t('common.save')}
          </Button>

          {mode === 'edit' && (
            <div className="flex gap-2 pt-1">
              {dish!.status === 'active' ? (
                <Button
                  variant="trough"
                  size="sm"
                  className="flex-1"
                  onClick={() => runStatus('archived')}
                >
                  <Archive className="h-4 w-4" />
                  {t('dishform.archive')}
                </Button>
              ) : (
                <Button
                  variant="trough"
                  size="sm"
                  className="flex-1"
                  onClick={() => runStatus('active')}
                >
                  <ArchiveRestore className="h-4 w-4" />
                  {t('dishform.restore')}
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={runDelete}
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </Button>
            </div>
          )}

          <DialogClose className="sr-only">{t('common.cancel')}</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
