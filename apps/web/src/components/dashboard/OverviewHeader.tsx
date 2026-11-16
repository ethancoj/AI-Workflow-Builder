'use client'

import { Bell, CalendarRange, Menu } from 'lucide-react'
import AccountMenu from '@/components/auth/AccountMenu'
import type { DataSource } from '@/lib/dashboard/types'

export default function OverviewHeader({
  source,
  onSourceChange,
  merchantName,
  onOpenNav,
}: {
  source: DataSource
  onSourceChange: (s: DataSource) => void
  merchantName?: string
  onOpenNav: () => void
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 md:px-6">
        <button
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="rounded-md p-1.5 text-ink hover:bg-page focus-visible:ring-2 focus-visible:ring-teal md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-ink">Overview</h1>
            {source === 'demo' && (
              <span className="rounded-full bg-amber-tint px-2.5 py-0.5 text-xs font-semibold text-amber-ink">
                Demo data
              </span>
            )}
          </div>
          <p className="text-sm text-muted">AI Workflow Builder for SMEs</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Live vs sample data. Demo is for presentations and usability testing. */}
          <div role="group" aria-label="Data shown" className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-medium">
            {(['live', 'demo'] as const).map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => onSourceChange(s)}
                className={`rounded-md px-2.5 py-1 focus-visible:ring-2 focus-visible:ring-teal ${
                  source === s ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {s === 'live' ? 'My data' : 'Demo data'}
              </button>
            ))}
          </div>

          {/* Read-only until date filtering exists: every figure below is all-time. */}
          <span
            title="Date filtering isn’t available yet. All figures are all-time."
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted"
          >
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            All time
          </span>

          <button
            disabled
            aria-label="Notifications (coming soon)"
            title="Notifications are coming soon"
            className="rounded-lg border border-line p-1.5 text-muted opacity-60"
          >
            <Bell className="h-4 w-4" aria-hidden />
          </button>

          <AccountMenu label={merchantName} />
        </div>
      </div>
    </header>
  )
}
