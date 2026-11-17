import { apiErrorMessage, apiFetch } from '@/lib/api'
import { listWorkflows, type WorkflowSummary } from '@/lib/workflow/workflowsApi'
import { capitalise } from './format'
import type { ActivityEvent, OverviewData, QuoteRow, Section } from './types'

// Builds the Overview from the logged-in merchant's real data. What exists today:
// saved workflows (Supabase, RLS), rubrics and saved photo assessments (FastAPI).
// No WhatsApp yet, so there are no customers, conversations or sent quotes.

type RubricRow = { id: string; name: string; service_type: string; created_at: string }
type AssessmentRow = {
  id: string
  rubric_id: string | null
  level_name: string
  price_estimate: number
  confidence: number
  escalated: boolean
  created_at: string
  image_url?: string
  reasoning?: string
}

async function getJson<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(await apiErrorMessage(res))
  return res.json()
}

const errorMessage = (r: PromiseRejectedResult) =>
  r.reason instanceof TypeError ? 'Couldn’t reach the server. Check your connection.' : String(r.reason?.message ?? r.reason)

function toQuoteRow(a: AssessmentRow, rubrics: Map<string, RubricRow>): QuoteRow {
  const rubric = a.rubric_id ? rubrics.get(a.rubric_id) : undefined
  const service = rubric ? `${capitalise(rubric.service_type)} · ${a.level_name}` : a.level_name
  return {
    id: a.id,
    customer: null, // photos currently come from the Quotes test page, not customers
    service,
    status: a.escalated ? 'needs_review' : 'draft',
    price: { min: a.price_estimate },
    receivedAt: a.created_at,
    confidence: a.confidence,
    level: a.level_name,
    photoUrl: a.image_url,
    reasoning: a.reasoning || undefined,
  }
}

export async function loadLiveOverview(): Promise<OverviewData> {
  const [workflowsR, rubricsR, assessmentsR] = await Promise.allSettled([
    listWorkflows(),
    getJson<RubricRow[]>('/api/quotes/rubrics'),
    getJson<AssessmentRow[]>('/api/quotes/assessments?limit=200'),
  ])

  const workflows: WorkflowSummary[] | null = workflowsR.status === 'fulfilled' ? workflowsR.value : null
  const rubrics = new Map((rubricsR.status === 'fulfilled' ? rubricsR.value : []).map((r) => [r.id, r]))
  const assessments: AssessmentRow[] | null = assessmentsR.status === 'fulfilled' ? assessmentsR.value : null
  const rows = assessments?.map((a) => toQuoteRow(a, rubrics)) ?? null

  const unavailable = (why: string) => ({ value: null, caption: why })

  const quotesSection: Section<QuoteRow[]> = rows
    ? { status: 'ready', data: rows.slice(0, 6) }
    : { status: 'error', message: errorMessage(assessmentsR as PromiseRejectedResult) }

  const reviewsSection: Section<QuoteRow[]> = rows
    ? { status: 'ready', data: rows.filter((r) => r.status === 'needs_review') }
    : quotesSection

  // Recent activity is stitched together from whatever loaded.
  const events: ActivityEvent[] = []
  workflows?.forEach((w) =>
    events.push({ id: `w-${w.id}`, kind: 'workflow', text: `Workflow “${w.name}” created`, at: w.created_at }),
  )
  if (rubricsR.status === 'fulfilled') {
    rubricsR.value.forEach((r) =>
      events.push({ id: `r-${r.id}`, kind: 'rubric', text: `Pricing rubric “${r.name}” saved`, at: r.created_at }),
    )
  }
  // Quote rows are already in the quotes table and review queue, so they aren't repeated here.
  events.sort((a, b) => b.at.localeCompare(a.at))
  const allFailed = !workflows && rubricsR.status === 'rejected'

  return {
    source: 'live',
    summary: {
      status: 'ready',
      data: {
        workflows: workflows
          ? { value: workflows.length, caption: 'saved · not deployed yet' }
          : unavailable('Couldn’t load workflows'),
        // No customers yet: every row is a test photo from the Pricing Rubric page, so say so.
        quoteRequests: rows
          ? { value: rows.length, caption: '', label: 'Photos tested' }
          : unavailable('Couldn’t load quotes'),
        quotesSent: unavailable('Needs WhatsApp'),
        booked: unavailable('Needs WhatsApp'),
      },
    },
    quotes: quotesSection,
    reviews: reviewsSection,
    workflowActivity: workflows
      ? {
          status: 'ready',
          data: {
            kind: 'workflows',
            workflows: workflows.slice(0, 5).map((w) => ({
              id: w.id,
              name: w.name,
              createdAt: w.created_at,
              openable: w.version === 1,
            })),
          },
        }
      : { status: 'error', message: errorMessage(workflowsR as PromiseRejectedResult) },
    events: allFailed
      ? { status: 'error', message: 'Couldn’t load any activity.' }
      : { status: 'ready', data: events.slice(0, 8) },
  }
}
