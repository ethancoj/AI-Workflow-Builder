'use client'

import { useShell } from '@/components/shell/AppShell'
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
  const { merchantName } = useShell()
  // The merchant's own business name is the most prominent name on their page (PRODUCT.md).
  const business = source === 'demo' ? DEMO_MERCHANT_NAME : merchantName

  return (
    <PageHeader
      title="Overview"
      subtitle={business || undefined}
      accountLabel={source === 'demo' ? DEMO_MERCHANT_NAME : undefined}
      actions={
        // Live vs sample data. Demo is for presentations and usability testing.
        <div role="group" aria-label="Data shown" className="inline-flex rounded-lg border border-line bg-brand-soft p-0.5 text-sm font-medium">
          {(['live', 'demo'] as const).map((s) => (
            <button
              key={s}
              aria-pressed={source === s}
              onClick={() => onSourceChange(s)}
              className={`min-h-9 rounded-md px-3 py-1.5 focus-visible:ring-2 focus-visible:ring-brand ${
                source === s ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              {s === 'live' ? 'My data' : 'Demo data'}
            </button>
          ))}
        </div>
      }
    />
  )
}
