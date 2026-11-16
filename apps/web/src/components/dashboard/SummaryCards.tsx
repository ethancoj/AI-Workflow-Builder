'use client'

import { AlertTriangle, Inbox, Send, Workflow, type LucideIcon } from 'lucide-react'
import type { Metric, Section, Summary } from '@/lib/dashboard/types'
import { REVIEW_QUEUE_ID } from './QuoteReviewPanel'

const CARDS: { key: keyof Summary; label: string; Icon: LucideIcon; highlight?: boolean; jumpTo?: string }[] = [
  { key: 'workflows', label: 'Saved Workflows', Icon: Workflow },
  { key: 'quoteRequests', label: 'Quote Requests', Icon: Inbox },
  { key: 'awaitingReview', label: 'Awaiting Review', Icon: AlertTriangle, highlight: true, jumpTo: REVIEW_QUEUE_ID },
  { key: 'quotesSent', label: 'Quotes Sent', Icon: Send },
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
  const className = `block rounded-[10px] border p-4 ${highlight ? 'border-highlight-line bg-highlight' : 'border-line bg-surface'}`
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-muted">
        <span className={highlight ? 'font-medium text-highlight-ink' : ''}>{label}</span>
        <Icon className={`h-4 w-4 ${highlight ? 'text-highlight-ink' : 'text-brand-ink'}`} aria-hidden />
      </div>
      {metric ? (
        <>
          <p className="mt-1.5 text-[28px] font-semibold leading-tight text-ink">
            {metric.value ?? <span className="text-muted" aria-label="Not available">—</span>}
          </p>
          <p className={`mt-1 text-xs ${highlight ? 'text-highlight-ink' : 'text-muted'}`}>{metric.caption}</p>
        </>
      ) : (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-brand-soft" aria-label="Loading" />
      )}
      {jumpTo && <p className="mt-2 text-xs font-medium text-highlight-ink underline underline-offset-2">Go to review queue ↓</p>}
    </>
  )

  if (!jumpTo) return <div className={className}>{body}</div>

  // Scrolls to the panel and moves keyboard focus there too.
  return (
    <a
      href={`#${jumpTo}`}
      onClick={(e) => {
        const target = document.getElementById(jumpTo)
        if (!target) return
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
        target.focus({ preventScroll: true })
      }}
      className={`${className} transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`}
    >
      {body}
    </a>
  )
}

export default function SummaryCards({ summary }: { summary: Section<Summary> }) {
  const data = summary.status === 'ready' ? summary.data : undefined
  return (
    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
      {CARDS.map(({ key, ...card }) => (
        <Card key={key} {...card} metric={data?.[key]} />
      ))}
    </div>
  )
}
