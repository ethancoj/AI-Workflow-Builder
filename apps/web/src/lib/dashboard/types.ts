// View model for the merchant Overview. Both the live loader and the demo fixtures
// produce this shape, so the UI components never know where data came from.

export type DataSource = 'live' | 'demo'

/** One independently loaded part of the page, so a failing API only breaks its own panels. */
export type Section<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

export type QuoteStatus =
  | 'pending_ai'
  | 'waiting_customer'
  | 'draft'
  | 'sent'
  | 'needs_review'
  // My data before WhatsApp: photos tested on the Pricing Rubric page, never sent to anyone
  | 'test_sure'
  | 'test_unsure'

export type Price = { min: number; max?: number }

export type QuoteRow = {
  id: string
  /** null when the request didn't come from a real customer (e.g. a test on the Quotes page). */
  customer: string | null
  service: string
  status: QuoteStatus
  price: Price | null
  receivedAt: string // ISO timestamp
  confidence?: number
  /** The condition level the AI picked from the rubric, e.g. "Moderately Dirty". */
  level?: string
  /** Short-lived link to the customer's photo (private bucket), when there is one. */
  photoUrl?: string
  /** The AI's own explanation of what it saw in the photo. */
  reasoning?: string
  /** The merchant's confidence level from the rubric (0–1), to show next to the AI's certainty. */
  threshold?: number
}

/**
 * value null = this metric isn't available yet; caption explains why.
 * label overrides the default stat name when the figure means something narrower (e.g. test photos).
 */
export type Metric = { value: number | null; caption: string; label?: string }

export type Summary = {
  workflows: Metric
  quoteRequests: Metric
  quotesSent: Metric
  booked: Metric
}

export type WorkflowActivity =
  | { kind: 'stages'; stages: { name: string; count: number }[] }
  | { kind: 'workflows'; workflows: { id: string; name: string; createdAt: string; openable: boolean }[] }

export type ActivityEvent = {
  id: string
  kind: 'quote' | 'review' | 'workflow' | 'rubric' | 'message' | 'booking'
  text: string
  at: string // ISO timestamp
}

export type OverviewData = {
  source: DataSource
  summary: Section<Summary>
  quotes: Section<QuoteRow[]>
  reviews: Section<QuoteRow[]>
  workflowActivity: Section<WorkflowActivity>
  events: Section<ActivityEvent[]>
}
