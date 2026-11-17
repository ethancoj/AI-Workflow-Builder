import { AlertTriangle, CheckCircle2, Clock, FileText, Loader, type LucideIcon } from 'lucide-react'
import type { QuoteStatus } from '@/lib/dashboard/types'

// Shape carries the meaning (solid = done, outlined = needs you, dashed = not final),
// with an icon and a text label, so it reads without colour. The only colour is the
// amber warning icon on "Needs your review" (DESIGN.md: colour is for status only).
const STATUS: Record<QuoteStatus, { label: string; Icon: LucideIcon; className: string; iconClass?: string }> = {
  sent: { label: 'Sent', Icon: CheckCircle2, className: 'border border-ink bg-ink text-surface' },
  needs_review: {
    label: 'Needs your review',
    Icon: AlertTriangle,
    className: 'border border-ink font-semibold text-ink',
    iconClass: 'text-amber-700',
  },
  // The AI priced it confidently, but nothing has gone to the customer yet.
  draft: { label: 'Not sent yet', Icon: FileText, className: 'border border-dashed border-ink/60 text-ink' },
  pending_ai: {
    label: 'AI is checking',
    Icon: Loader,
    className: 'border border-dashed border-muted text-muted',
    iconClass: 'motion-safe:animate-pulse',
  },
  // Merchant asked for a clearer photo; the next move is the customer's.
  waiting_customer: {
    label: 'Waiting for customer',
    Icon: Clock,
    className: 'border border-dashed border-muted text-muted',
  },
}

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  const { label, Icon, className, iconClass = '' } = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden />
      {label}
    </span>
  )
}
