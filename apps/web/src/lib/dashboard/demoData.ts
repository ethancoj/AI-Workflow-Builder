import type { OverviewData, QuoteRow } from './types'

// Sample data for demos and usability testing. Never mixed with live data:
// the Overview shows a "Demo data" label whenever this is on screen.

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function demoOverview(): OverviewData {
  const quotes: QuoteRow[] = [
    { id: 'd1', customer: 'Ahmad Faizal', service: 'Aircon chemical wash', status: 'needs_review', price: { min: 120, max: 180 }, receivedAt: minutesAgo(6), confidence: 0.52 },
    { id: 'd2', customer: 'Tan Mei Ling', service: 'Aircon general service', status: 'draft', price: { min: 80 }, receivedAt: minutesAgo(22), confidence: 0.88 },
    { id: 'd3', customer: 'Priya Ramasamy', service: 'Aircon not cold', status: 'pending_ai', price: null, receivedAt: minutesAgo(41) },
    { id: 'd4', customer: 'Lim Wei Jie', service: 'Aircon general service', status: 'sent', price: { min: 150 }, receivedAt: minutesAgo(95), confidence: 0.91 },
    { id: 'd5', customer: 'Nurul Aisyah', service: 'Aircon chemical wash', status: 'needs_review', price: { min: 180 }, receivedAt: minutesAgo(180), confidence: 0.47 },
    { id: 'd6', customer: 'Kumar Selvam', service: 'Gas top-up', status: 'sent', price: { min: 100, max: 140 }, receivedAt: minutesAgo(320), confidence: 0.83 },
  ]

  return {
    source: 'demo',
    summary: {
      status: 'ready',
      data: {
        workflows: { value: 3, caption: '2 live on WhatsApp' },
        quoteRequests: { value: 24, caption: 'photos received' },
        awaitingReview: { value: 2, caption: 'low-confidence quotes' },
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
        { id: 'e1', kind: 'review', text: 'Ahmad Faizal’s quote flagged for review (52% confidence)', at: minutesAgo(6) },
        { id: 'e2', kind: 'quote', text: 'AI quote drafted for Tan Mei Ling: RM80', at: minutesAgo(22) },
        { id: 'e3', kind: 'message', text: 'Priya Ramasamy sent a photo', at: minutesAgo(41) },
        { id: 'e4', kind: 'quote', text: 'Quote sent to Lim Wei Jie: RM150', at: minutesAgo(90) },
        { id: 'e5', kind: 'workflow', text: 'Workflow “Aircon quote bot” updated', at: minutesAgo(240) },
      ],
    },
  }
}
