'use client'

import type { Metric, Section, Summary } from '@/lib/dashboard/types'

// A quiet row of figures under the review queue: big number, small label, no card chrome.
// The queue above already covers what needs the merchant, so nothing here competes with it.
const STATS: { key: keyof Summary; label: string }[] = [
  { key: 'quoteRequests', label: 'Quote requests' },
  { key: 'quotesSent', label: 'Quotes sent' },
  { key: 'booked', label: 'Booked' },
  { key: 'workflows', label: 'Saved workflows' },
]

function Stat({ label, metric }: { label: string; metric?: Metric }) {
  return (
    <div className="min-w-0 py-1">
      <dt className="text-xs text-muted">{metric?.label ?? label}</dt>
      <dd className="mt-0.5">
        {metric ? (
          <>
            <span className="block text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-ink">
              {metric.value ?? (
                <span className="text-muted" role="img" aria-label="Not available">
                  —
                </span>
              )}
            </span>
            {/* Only explain a missing figure; real numbers speak for themselves. */}
            {metric.value === null && <span className="mt-0.5 block text-xs text-muted">{metric.caption}</span>}
          </>
        ) : (
          <span className="mt-1 block h-8 w-14 animate-pulse rounded bg-brand-soft" role="status" aria-label="Loading" />
        )}
      </dd>
    </div>
  )
}

const COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' }

export default function SummaryCards({ summary }: { summary: Section<Summary> }) {
  const data = summary.status === 'ready' ? summary.data : undefined
  // Figures that don't exist yet are named once in a footnote rather than shown as a row of "—".
  const missing = data ? STATS.filter(({ key }) => data[key].value === null) : []
  const shown = STATS.filter((s) => !missing.includes(s))
  return (
    <section aria-label="Summary" className="border-y border-divider py-3">
      <dl
        className={`grid grid-cols-2 gap-x-6 gap-y-3 ${COLS[shown.length] ?? 'sm:grid-cols-4'} sm:divide-x sm:divide-divider [&>*]:sm:pl-6 [&>*:first-child]:sm:pl-0`}
      >
        {shown.map(({ key, label }) => (
          <Stat key={key} label={label} metric={data?.[key]} />
        ))}
      </dl>
      <p className="mt-2 text-xs text-muted">
        All figures are all-time.
        {missing.length > 0 &&
          ` ${missing.map((m) => m.label).join(' and ')} start once WhatsApp is connected.`}
      </p>
    </section>
  )
}
