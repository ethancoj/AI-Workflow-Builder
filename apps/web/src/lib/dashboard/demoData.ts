import type { OverviewData, QuoteRow } from './types'

// Sample data for demos and usability testing. Never mixed with live data:
// the Overview shows a "Demo data" label whenever this is on screen.

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function demoOverview(): OverviewData {
  const quotes: QuoteRow[] = [
    { id: 'd3', customer: 'Priya Ramasamy', service: 'Aircon not cold', status: 'pending_ai', price: null, receivedAt: minutesAgo(1) },
    { id: 'd1', customer: 'Ahmad Faizal', service: 'Aircon chemical wash', status: 'needs_review', price: { min: 120, max: 180 }, receivedAt: minutesAgo(6), confidence: 0.52, level: 'Moderately Dirty', reasoning: 'Thick dust on the filter, but the photo is taken from an angle and the fins are only partly visible, so it could also be Heavily Soiled.' },
    { id: 'd2', customer: 'Tan Mei Ling', service: 'Aircon general service', status: 'draft', price: { min: 80 }, receivedAt: minutesAgo(22), confidence: 0.88, level: 'Clean / Light Dust' },
    { id: 'd4', customer: 'Lim Wei Jie', service: 'Aircon general service', status: 'sent', price: { min: 150 }, receivedAt: minutesAgo(95), confidence: 0.91, level: 'Moderately Dirty' },
    { id: 'd5', customer: 'Nurul Aisyah', service: 'Aircon chemical wash', status: 'needs_review', price: { min: 180 }, receivedAt: minutesAgo(180), confidence: 0.47, level: 'Heavily Soiled / Mouldy', reasoning: 'Dark patches that may be mould, but the photo is dim and blurry, so they could also be shadows.' },
    { id: 'd6', customer: 'Kumar Selvam', service: 'Gas top-up', status: 'sent', price: { min: 100, max: 140 }, receivedAt: minutesAgo(320), confidence: 0.83 },
  ]

  return {
    source: 'demo',
    summary: {
      status: 'ready',
      data: {
        workflows: { value: 3, caption: 'saved · not live yet' },
        quoteRequests: { value: 24, caption: 'photos received' },
        awaitingReview: { value: 2, caption: 'the AI wasn’t sure about these' },
        quotesSent: { value: 15, caption: 'sent to customers' },
      },
    },
    quotes: { status: 'ready', data: quotes },
    reviews: { status: 'ready', data: quotes.filter((q) => q.status === 'needs_review') },
    workflowActivity: {
      status: 'ready',
      data: {
        kind: 'stages',
        stages: [
          { name: 'Greeting', count: 48 },
          { name: 'Photo requested', count: 31 },
          { name: 'AI quote ready', count: 24 },
          { name: 'Booked', count: 15 },
        ],
      },
    },
    events: {
      status: 'ready',
      data: [
        { id: 'e3', kind: 'message', text: 'Priya Ramasamy sent a photo', at: minutesAgo(1) },
        { id: 'e1', kind: 'review', text: 'Ahmad Faizal’s quote needs your review', at: minutesAgo(6) },
        { id: 'e2', kind: 'quote', text: 'AI quote drafted for Tan Mei Ling: RM80', at: minutesAgo(22) },
                { id: 'e4', kind: 'quote', text: 'Quote sent to Lim Wei Jie: RM150', at: minutesAgo(90) },
        { id: 'e5', kind: 'workflow', text: 'Workflow “Aircon quote bot” updated', at: minutesAgo(240) },
      ],
    },
  }
}

/** Business name shown in the header while demo data is on screen. */
export const DEMO_MERCHANT_NAME = 'Breezy AC Services'

/** Takes a quote out of the review queue (demo only): `status` is what it becomes. */
function resolveDemoQuote(
  data: OverviewData,
  id: string,
  change: (q: QuoteRow) => { row: QuoteRow; event: string; sent: boolean },
): OverviewData {
  if (data.quotes.status !== 'ready' || data.reviews.status !== 'ready' || data.summary.status !== 'ready') return data
  const quote = data.reviews.data.find((q) => q.id === id)
  if (!quote) return data
  const { row, event, sent } = change(quote)
  const { awaitingReview, quotesSent } = data.summary.data
  const bump = (m: { value: number | null; caption: string }, by: number) => ({ ...m, value: (m.value ?? 0) + by })

  return {
    ...data,
    summary: {
      status: 'ready',
      data: {
        ...data.summary.data,
        awaitingReview: bump(awaitingReview, -1),
        quotesSent: sent ? bump(quotesSent, 1) : quotesSent,
      },
    },
    quotes: { status: 'ready', data: data.quotes.data.map((q) => (q.id === id ? row : q)) },
    reviews: { status: 'ready', data: data.reviews.data.filter((q) => q.id !== id) },
    events:
      data.events.status === 'ready'
        ? {
            status: 'ready',
            data: [{ id: `done-${id}-${Date.now()}`, kind: 'quote', text: event, at: new Date().toISOString() }, ...data.events.data],
          }
        : data.events,
  }
}

/** Demo: ask the customer for a clearer photo instead of sending a price. */
export function askForPhotoDemo(data: OverviewData, id: string): OverviewData {
  return resolveDemoQuote(data, id, (q) => ({
    row: { ...q, status: 'pending_ai', price: null, confidence: undefined },
    event: `Asked ${q.customer} for a clearer photo`,
    sent: false,
  }))
}

/**
 * Approve a demo quote at `finalPrice` and "send" it. Returns new demo data and never
 * touches the API: demo actions only change what's on screen.
 */
export function approveDemoQuote(data: OverviewData, id: string, finalPrice: number): OverviewData {
  return resolveDemoQuote(data, id, (q) => ({
    row: { ...q, status: 'sent', price: { min: finalPrice } },
    event: `Quote sent to ${q.customer}: RM${finalPrice}`,
    sent: true,
  }))
}
