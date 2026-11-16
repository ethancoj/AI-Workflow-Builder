import { AlertTriangle, Inbox, Send, Workflow, type LucideIcon } from 'lucide-react'
import type { Metric, Section, Summary } from '@/lib/dashboard/types'

const CARDS: { key: keyof Summary; label: string; Icon: LucideIcon; highlight?: boolean }[] = [
  { key: 'workflows', label: 'Saved Workflows', Icon: Workflow },
  { key: 'quoteRequests', label: 'Quote Requests', Icon: Inbox },
  { key: 'awaitingReview', label: 'Awaiting Review', Icon: AlertTriangle, highlight: true },
  { key: 'quotesSent', label: 'Quotes Sent', Icon: Send },
]

function Card({ label, Icon, metric, highlight }: { label: string; Icon: LucideIcon; metric?: Metric; highlight?: boolean }) {
  return (
    <div className={`rounded-[10px] border p-4 ${highlight ? 'border-amber-line bg-amber-tint' : 'border-line bg-surface'}`}>
      <div className="flex items-center justify-between text-sm text-muted">
        <span className={highlight ? 'font-medium text-amber-ink' : ''}>{label}</span>
        <Icon className={`h-4 w-4 ${highlight ? 'text-amber-ink' : 'text-teal-ink'}`} aria-hidden />
      </div>
      {metric ? (
        <>
          <p className="mt-1.5 text-[28px] font-semibold leading-tight text-ink">
            {metric.value ?? <span className="text-muted" aria-label="Not available">—</span>}
          </p>
          <p className={`mt-1 text-xs ${highlight ? 'text-amber-ink' : 'text-muted'}`}>{metric.caption}</p>
        </>
      ) : (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-line/60" aria-label="Loading" />
      )}
    </div>
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
