'use client'

import { Bell, CalendarRange } from 'lucide-react'
import PageHeader from '@/components/shell/PageHeader'
import { DEMO_MERCHANT_NAME } from '@/lib/dashboard/demoData'
import type { DataSource } from '@/lib/dashboard/types'

export default function OverviewHeader({
  source,
  onSourceChange,
}: {
  source: DataSource
  onSourceChange: (s: DataSource) => void
}) {
  return (
    <PageHeader
      title="Overview"
      subtitle="AI Workflow Builder for SMEs"
      // The demo banner below says it's demo data; here we only swap in the demo business name.
      accountLabel={source === 'demo' ? DEMO_MERCHANT_NAME : undefined}
      actions={
        <>
          {/* Live vs sample data. Demo is for presentations and usability testing. */}
          <div role="group" aria-label="Data shown" className="inline-flex rounded-lg border border-line bg-page p-0.5 text-xs font-medium">
            {(['live', 'demo'] as const).map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => onSourceChange(s)}
                className={`rounded-md px-2.5 py-1 focus-visible:ring-2 focus-visible:ring-brand ${
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
        </>
      }
    />
  )
}
