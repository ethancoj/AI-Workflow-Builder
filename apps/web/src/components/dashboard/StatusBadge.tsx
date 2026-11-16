import { AlertTriangle, CheckCircle2, FileText, Loader } from 'lucide-react'
import type { QuoteStatus } from '@/lib/dashboard/types'

// Each status has an icon AND a text label, so it reads correctly without colour.
const STATUS = {
  pending_ai: { label: 'Pending AI', Icon: Loader, className: 'bg-line/60 text-ink' },
  draft: { label: 'Draft', Icon: FileText, className: 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  sent: { label: 'Sent', Icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  needs_review: { label: 'Needs Review', Icon: AlertTriangle, className: 'bg-amber-tint text-amber-ink' },
} satisfies Record<QuoteStatus, unknown>

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  const { label, Icon, className } = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  )
}
