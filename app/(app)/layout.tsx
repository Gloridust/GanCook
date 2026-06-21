import { requireUser } from '@/lib/auth/user'
import { BottomNav } from '@/components/bottom-nav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md px-4 pb-28 pt-5">
      {children}
      <BottomNav />
    </div>
  )
}
