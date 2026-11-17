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
  const business = source === 'demo' ? DEMO_MERCHANT_NAME : merchantName

  return (
    <PageHeader
      // PRODUCT.md: the merchant's business name is the most prominent name on their page.
      title={business || 'Overview'}
      eyebrow={business ? 'Overview' : undefined}
      accountLabel={source === 'demo' ? DEMO_MERCHANT_NAME : undefined}
      actions={
        // Live vs sample data. Demo is for presentations and usability testing.
        <div role="group" aria-label="Data shown" className="inline-flex rounded-lg border border-line p-0.5 text-sm font-medium">
          {(['live', 'demo'] as const).map((s) => (
            <button
              key={s}
              aria-pressed={source === s}
              onClick={() => onSourceChange(s)}
              className={`min-h-10 rounded-md px-3 focus-visible:ring-2 focus-visible:ring-brand ${
                source === s ? 'bg-brand text-brand-on' : 'text-muted hover:text-ink'
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
