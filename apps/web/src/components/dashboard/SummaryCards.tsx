'use client'

import { AlertTriangle, Inbox, Send, Workflow, type LucideIcon } from 'lucide-react'
import type { Metric, Section, Summary } from '@/lib/dashboard/types'
import { REVIEW_QUEUE_ID, REVIEW_TITLE } from './QuoteReviewPanel'

// What needs the merchant comes first (DESIGN.md: Attention-First Rule).
const CARDS: { key: keyof Summary; label: string; Icon: LucideIcon; highlight?: boolean; jumpTo?: string }[] = [
  { key: 'awaitingReview', label: REVIEW_TITLE, Icon: AlertTriangle, highlight: true, jumpTo: REVIEW_QUEUE_ID },
  { key: 'quoteRequests', label: 'Quote requests', Icon: Inbox },
  { key: 'quotesSent', label: 'Quotes sent', Icon: Send },
  { key: 'workflows', label: 'Saved workflows', Icon: Workflow },
]

function Card({
  label,
  Icon,
  metric,
  highlight,
  jumpTo,
}: {
  label: string
  Icon: LucideIcon
  metric?: Metric
  highlight?: boolean
  jumpTo?: string
}) {
  const className = `block rounded-[10px] border p-3 sm:p-4 ${highlight ? 'border-highlight-line bg-highlight' : 'border-line bg-surface'}`
  const body = (
    <>
      <div className="flex items-start justify-between gap-2 text-sm text-muted">
        <span className={highlight ? 'font-medium text-highlight-ink' : ''}>{label}</span>
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? 'text-amber-700' : 'text-brand-ink'}`} aria-hidden />
      </div>
      {metric ? (
        <>
          <p className="mt-1 text-2xl font-semibold leading-tight tabular-nums text-ink sm:mt-1.5 sm:text-[28px]">
            {metric.value ?? <span className="text-muted" aria-label="Not available">—</span>}
          </p>
          <p className={`mt-1 text-xs ${highlight ? 'text-highlight-ink' : 'text-muted'}`}>{metric.caption}</p>
        </>
      ) : (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-brand-soft" role="status" aria-label="Loading" />
      )}
    </>
  )

  if (!jumpTo) return <div className={className}>{body}</div>

  // Scrolls to the review queue and moves keyboard focus there too.
  return (
    <a
      href={`#${jumpTo}`}
      aria-label={`${label}: ${metric?.value ?? ''}. Go to the list`}
      onClick={(e) => {
        const target = document.getElementById(jumpTo)
        if (!target) return
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        target.focus({ preventScroll: true })
      }}
      className={`${className} hover:bg-divider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
    >
      {body}
    </a>
  )
}

export default function SummaryCards({ summary }: { summary: Section<Summary> }) {
  const data = summary.status === 'ready' ? summary.data : undefined
  return (
    <section aria-label="Summary">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CARDS.map(({ key, ...card }) => (
          <Card key={key} {...card} metric={data?.[key]} />
        ))}
      </div>
      <p className="mt-2 text-right text-xs text-muted">All figures are all-time.</p>
    </section>
  )
}
