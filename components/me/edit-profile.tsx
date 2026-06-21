'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Camera } from 'lucide-react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { useT } from '@/components/i18n-provider'
import { compressImage } from '@/lib/client/compress-image'
import { updateProfile } from '@/lib/actions/profile'

export function EditProfile({
  name: initName,
  avatarPath,
  children,
}: {
  name: string
  avatarPath: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initName)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(
    avatarPath ? `/api/uploads/${avatarPath}` : null,
  )
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const compressed = await compressImage(f, 512)
    setBlob(compressed)
    setPreview(URL.createObjectURL(compressed))
  }

  const submit = () => {
    setError('')
    if (!name.trim()) return setError(t('err.nameRequired'))
    const form = new FormData()
    form.set('name', name)
    if (blob) form.set('avatar', blob, 'avatar.jpg')
    startTransition(async () => {
      const res = await updateProfile(form)
      if (res.ok) {
        setOpen(false)
        router.refresh()
      } else setError(res.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setName(initName)
          setError('')
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent title={t('profile.title')}>
        <div className="flex flex-col items-center gap-4">
          {/* 头像（点击更换） */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative h-24 w-24"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <Avatar name={name || initName} size={96} />
            )}
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-accent-strong text-white shadow-[0_2px_6px_rgba(47,122,72,0.4)]">
              <Camera className="h-4 w-4" />
            </span>
          </button>
          <p className="text-xs text-secondary">{t('profile.tapPhoto')}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={pick}
          />

          <div className="w-full">
            <Label htmlFor="profile-name">{t('login.nickname')}</Label>
            <Input
              id="profile-name"
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button
            className="w-full"
            size="lg"
            loading={pending}
            onClick={submit}
          >
            {t('common.save')}
          </Button>
          <DialogClose className="sr-only">{t('common.cancel')}</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
