import { redirect } from 'next/navigation'
import { isSetupNeeded, getCurrentUser } from '@/lib/auth/user'

export const dynamic = 'force-dynamic'

export default async function Root() {
  if (isSetupNeeded()) redirect('/setup')
  const user = await getCurrentUser()
  redirect(user ? '/home' : '/login')
}
