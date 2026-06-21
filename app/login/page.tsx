import { redirect } from 'next/navigation'
import { isSetupNeeded, listMembers } from '@/lib/auth/user'
import { getSettings } from '@/lib/settings'
import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  if (isSetupNeeded()) redirect('/setup')
  const s = getSettings()
  const members = listMembers().map((m) => ({
    id: m.id,
    name: m.name,
    avatarPath: m.avatarPath,
  }))
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <LoginForm
        familyName={s.familyName}
        registrationOpen={s.registrationOpen}
        hasJoinCode={!!s.joinCode}
        members={members}
      />
    </main>
  )
}
