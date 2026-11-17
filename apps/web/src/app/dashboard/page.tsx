'use client'

import { Info } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import RequireAuth from '@/components/auth/RequireAuth'
import { RecentActivityPanel, WorkflowActivityPanel } from '@/components/dashboard/ActivityPanels'
import OverviewHeader from '@/components/dashboard/OverviewHeader'
import { RetryContext } from '@/components/dashboard/Panel'
import QuoteReviewPanel, { type ReviewReceipt } from '@/components/dashboard/QuoteReviewPanel'
import RecentQuotesTable from '@/components/dashboard/RecentQuotesTable'
import SummaryCards from '@/components/dashboard/SummaryCards'
import AppShell from '@/components/shell/AppShell'
import { approveDemoQuote, askForPhotoDemo, demoOverview } from '@/lib/dashboard/demoData'
import { loadLiveOverview } from '@/lib/dashboard/liveData'
import type { DataSource, OverviewData } from '@/lib/dashboard/types'

const LOADING: OverviewData = {
  source: 'live',
  summary: { status: 'loading' },
  quotes: { status: 'loading' },
  reviews: { status: 'loading' },
  workflowActivity: { status: 'loading' },
  events: { status: 'loading' },
}

const SOURCE_KEY = 'overview-source'
const RECEIPT_MS = 8000

function Overview() {
  const [source, setSource] = useState<DataSource>('live')
  const [live, setLive] = useState<OverviewData>(LOADING)
  // Demo data lives in state so demo review actions can change it (on screen only).
  const [demo, setDemo] = useState<OverviewData>(demoOverview)
  const [receipt, setReceipt] = useState<ReviewReceipt | null>(null)
  const receiptTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Remember the live/demo choice per browser (a convenience only; defaults to live).
  useEffect(() => {
    try {
      if (localStorage.getItem(SOURCE_KEY) === 'demo') queueMicrotask(() => setSource('demo'))
    } catch {}
  }, [])
  const changeSource = (s: DataSource) => {
    setSource(s)
    setReceipt(null)
    try {
      localStorage.setItem(SOURCE_KEY, s)
    } catch {}
  }

  const fetchLive = useCallback(() => {
    let cancelled = false
    loadLiveOverview().then((d) => !cancelled && setLive(d))
    return () => {
      cancelled = true
    }
  }, [])
  useEffect(() => fetchLive(), [fetchLive])
  // "Try again" on a failed panel: show loading, then fetch everything again.
  const retryLive = useCallback(() => {
    setLive(LOADING)
    fetchLive()
  }, [fetchLive])

  useEffect(() => () => clearTimeout(receiptTimer.current), [])

  /** Demo review actions: apply the change, then offer Undo for a few seconds. */
  const applyDemo = (change: (d: OverviewData) => OverviewData, text: string) => {
    const before = demo
    setDemo(change(demo))
    clearTimeout(receiptTimer.current)
    setReceipt({
      text,
      onUndo: () => {
        setDemo(before)
        setReceipt(null)
        clearTimeout(receiptTimer.current)
      },
    })
    receiptTimer.current = setTimeout(() => setReceipt(null), RECEIPT_MS)
  }

  const customerName = (id: string) =>
    (demo.reviews.status === 'ready' && demo.reviews.data.find((q) => q.id === id)?.customer) || 'the customer'

  const data = source === 'demo' ? demo : live

  return (
    <RetryContext.Provider value={source === 'live' ? retryLive : null}>
      <OverviewHeader source={source} onSourceChange={changeSource} />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        {source === 'demo' && (
          <p className="flex items-start gap-2 rounded-[10px] border border-dashed border-line px-4 py-2.5 text-sm text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              You’re viewing <strong className="font-semibold text-ink">demo data</strong>. These customers and numbers are
              examples, not your business.
            </span>
          </p>
        )}

        {/*
          Phone: the review queue comes first (Attention-First Rule), then the numbers.
          Desktop: numbers across the top; queue and recent quotes on the left; activity on the right.
        */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:grid-rows-[auto_auto_1fr]">
          <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
            <QuoteReviewPanel
              reviews={data.reviews}
              receipt={source === 'demo' ? receipt : null}
              onApprove={
                source === 'demo'
                  ? (id, price) =>
                      applyDemo((d) => approveDemoQuote(d, id, price), `Sent RM${price} to ${customerName(id)}.`)
                  : undefined
              }
              onAskForPhoto={
                source === 'demo'
                  ? (id) => applyDemo((d) => askForPhotoDemo(d, id), `Asked ${customerName(id)} for a clearer photo.`)
                  : undefined
              }
            />
          </div>
          <div className="min-w-0 lg:col-span-2 lg:row-start-1">
            <SummaryCards summary={data.summary} />
          </div>
          <div className="min-w-0 lg:col-start-1 lg:row-start-3 lg:self-start">
            <RecentQuotesTable quotes={data.quotes} source={data.source} />
          </div>
          <div className="min-w-0 space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:self-start">
            <WorkflowActivityPanel activity={data.workflowActivity} />
            <RecentActivityPanel events={data.events} />
          </div>
        </div>
      </main>
    </RetryContext.Provider>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <AppShell active="/dashboard">
        <Overview />
      </AppShell>
    </RequireAuth>
  )
}
