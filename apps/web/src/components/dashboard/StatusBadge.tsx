import { AlertTriangle, CheckCircle2, FileText, Loader } from 'lucide-react'
import type { QuoteStatus } from '@/lib/dashboard/types'

// Each status has an icon AND a text label, so it reads correctly without colour.
const STATUS = {
  pending_ai: { label: 'Pending AI', Icon: Loader, className: 'border border-dashed border-muted text-muted' },
  draft: { label: 'Draft', Icon: FileText, className: 'border border-line text-ink' },
  sent: { label: 'Sent', Icon: CheckCircle2, className: 'border border-brand bg-brand text-brand-on' },
  needs_review: { label: 'Needs Review', Icon: AlertTriangle, className: 'border border-highlight-line bg-highlight font-semibold text-highlight-ink' },
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
