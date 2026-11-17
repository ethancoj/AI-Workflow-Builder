'use client'

import type { ReactNode } from 'react'
import AccountMenu from '@/components/auth/AccountMenu'
import { NavButton, useShell } from './AppShell'

/** White page header: title + subtitle on the left, page controls and the account menu on the right. */
export default function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  accountLabel,
}: {
  title: string
  subtitle?: string
  badge?: ReactNode
  actions?: ReactNode
  /** Overrides the business name next to Log out (e.g. the demo merchant). */
  accountLabel?: string
}) {
  const { merchantName } = useShell()
  return (
    <header className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-6">
        <NavButton />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <AccountMenu label={accountLabel ?? merchantName} />
        </div>
      </div>
    </header>
  )
}
