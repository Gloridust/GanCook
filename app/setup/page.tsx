import { redirect } from 'next/navigation'
import { isSetupNeeded } from '@/lib/auth/user'
import { SetupForm } from './setup-form'

export const dynamic = 'force-dynamic'

export default function SetupPage() {
  if (!isSetupNeeded()) redirect('/login')
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <SetupForm />
    </main>
  )
}
