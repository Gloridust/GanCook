'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, UtensilsCrossed, ChefHat, Sprout, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/components/i18n-provider'

const TABS = [
  { href: '/home', key: 'nav.home', icon: Home },
  { href: '/meals', key: 'nav.meals', icon: UtensilsCrossed },
  { href: '/dishes', key: 'nav.dishes', icon: ChefHat },
  { href: '/wall', key: 'nav.wall', icon: Sprout },
  { href: '/me', key: 'nav.me', icon: User },
] as const

/** 浮动底部 Tab Bar：trough 凹槽 + 选中项白色浮起 bump（layoutId 滑动） */
export function BottomNav() {
  const pathname = usePathname()
  const t = useT()
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="mf-trough pointer-events-auto flex items-center gap-1 p-1.5 shadow-[0_4px_18px_rgba(56,71,60,0.16)]">
        {TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(tab.href + '/')
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'relative flex h-12 w-[58px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-medium',
                active ? 'text-accent' : 'text-secondary',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-bump"
                  className="mf-bump absolute inset-0 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon className="relative z-10 h-5 w-5" />
              <span className="relative z-10">{t(tab.key)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
