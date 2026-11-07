'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ImagePlus,
  Trash2,
  Archive,
  ArchiveRestore,
  Link2,
  Download,
} from 'lucide-react'
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
import {
  discardImportedRecipeImage,
  importRecipeFromUrl,
} from '@/lib/actions/recipe-import'
import {
  importProgressPhaseAt,
  type ImportProgressPhase,
} from '@/lib/recipe/import-progress'
import type { Dish } from '@/lib/db/schema'

const IMPORT_PROGRESS_KEYS: Record<ImportProgressPhase, string> = {
  cleaning: 'dishform.importProgressCleaning',
  fetching: 'dishform.importProgressFetching',
  extracting: 'dishform.importProgressExtracting',
  image: 'dishform.importProgressImage',
}

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
  const [instructions, setInstructions] = useState(dish?.instructions ?? '')
  const [tags, setTags] = useState((dish?.tags ?? []).join(' '))
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(
    dish?.imagePath ? `/api/uploads/${dish.imagePath}` : null,
  )
  const [error, setError] = useState('')
  const [importText, setImportText] = useState('')
  const [importedImageToken, setImportedImageToken] = useState<string | null>(
    null,
  )
  const [importNotice, setImportNotice] = useState('')
  const [importProgress, setImportProgress] =
    useState<ImportProgressPhase | null>(null)
  const [pending, startTransition] = useTransition()
  const [importing, startImportTransition] = useTransition()
  const openRef = useRef(false)
  const mountedRef = useRef(true)
  const importTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const objectPreviewRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (importTimerRef.current) clearInterval(importTimerRef.current)
      if (objectPreviewRef.current) URL.revokeObjectURL(objectPreviewRef.current)
    }
  }, [])

  const stopImportProgress = () => {
    if (importTimerRef.current) {
      clearInterval(importTimerRef.current)
      importTimerRef.current = null
    }
    if (mountedRef.current) setImportProgress(null)
  }

  const startImportProgress = () => {
    stopImportProgress()
    const startedAt = Date.now()
    setImportProgress(importProgressPhaseAt(0))
    importTimerRef.current = setInterval(() => {
      if (!openRef.current) {
        stopImportProgress()
        return
      }
      setImportProgress(importProgressPhaseAt(Date.now() - startedAt))
    }, 500)
  }

  const setObjectPreview = (value: string | null) => {
    if (objectPreviewRef.current) URL.revokeObjectURL(objectPreviewRef.current)
    objectPreviewRef.current = value
    setPreview(value)
  }

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const compressed = await compressImage(f)
    if (importedImageToken) {
      void discardImportedRecipeImage(importedImageToken)
      setImportedImageToken(null)
    }
    setBlob(compressed)
    setObjectPreview(URL.createObjectURL(compressed))
  }

  const runImport = () => {
    setError('')
    setImportNotice('')
    startImportProgress()
    startImportTransition(async () => {
      try {
        const res = await importRecipeFromUrl({
          shareText: importText,
          previousImageToken: importedImageToken,
        })
        if (!res.ok) {
          if (openRef.current) setError(res.error)
          return
        }
        if (!openRef.current) {
          void discardImportedRecipeImage(res.recipe.imageToken)
          return
        }
        setName(res.recipe.name)
        setDescription(res.recipe.description)
        setInstructions(res.recipe.instructions)
        setTags(res.recipe.tags.join(' '))
        setBlob(null)
        setImportedImageToken(res.recipe.imageToken)
        setObjectPreview(null)
        setPreview(
          res.recipe.imagePreviewPath && res.recipe.imageToken
            ? `/api/uploads/${res.recipe.imagePreviewPath}?token=${encodeURIComponent(res.recipe.imageToken)}`
            : null,
        )
        setImportNotice(
          res.recipe.llmWarning
            ? t('dishform.importedLlmWarning')
            : res.recipe.imageWarning
              ? t('dishform.importedImageWarning')
              : t('dishform.imported'),
        )
      } finally {
        stopImportProgress()
      }
    })
  }

  const submit = () => {
    setError('')
    if (!name.trim()) return setError(t('err.dishNameRequired'))
    const form = new FormData()
    form.set('name', name)
    form.set('description', description)
    form.set('instructions', instructions)
    form.set('tags', tags)
    if (blob) form.set('image', blob, 'dish.jpg')
    if (importedImageToken) {
      form.set('importedImageToken', importedImageToken)
    }
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
          setInstructions('')
          setTags('')
          setBlob(null)
          setObjectPreview(null)
          setPreview(null)
          setImportText('')
          setImportedImageToken(null)
          setImportNotice('')
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

  const changeOpen = (next: boolean) => {
    openRef.current = next
    if (!next) stopImportProgress()
    if (!next && mode === 'create' && importedImageToken) {
      void discardImportedRecipeImage(importedImageToken)
      setImportedImageToken(null)
      setObjectPreview(null)
      setPreview(null)
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        title={mode === 'create' ? t('dishform.addTitle') : t('dishform.editTitle')}
        className="max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-4">
          {mode === 'create' && (
            <div className="mf-tonal space-y-3 rounded-2xl p-3.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-accent">
                <Link2 className="h-4 w-4" />
                {t('dishform.importTitle')}
              </div>
              <Textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={t('dishform.importPh')}
                className="min-h-[72px] bg-surface"
                maxLength={2_000}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full"
                loading={importing}
                disabled={!importText.trim()}
                onClick={runImport}
              >
                <Download className="h-4 w-4" />
                {t('dishform.import')}
              </Button>
              {importProgress && (
                <div
                  className="flex items-center justify-center gap-2 text-xs text-secondary"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                    aria-hidden="true"
                  />
                  {t(IMPORT_PROGRESS_KEYS[importProgress])}
                </div>
              )}
              {importNotice && (
                <p className="text-xs text-secondary">{importNotice}</p>
              )}
            </div>
          )}

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
            <Label htmlFor="dish-instructions">
              {t('dishform.instructions')}
            </Label>
            <Textarea
              id="dish-instructions"
              placeholder={t('dishform.instructionsPh')}
              value={instructions}
              maxLength={50000}
              className="min-h-40 leading-6"
              onChange={(e) => setInstructions(e.target.value)}
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

          <Button
            className="w-full"
            size="lg"
            loading={pending}
            disabled={importing}
            onClick={submit}
          >
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
