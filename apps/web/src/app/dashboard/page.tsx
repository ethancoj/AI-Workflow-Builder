'use client'

import { useEffect, useState } from 'react'
import RequireAuth from '@/components/auth/RequireAuth'
import { RecentActivityPanel, WorkflowActivityPanel } from '@/components/dashboard/ActivityPanels'
import OverviewHeader from '@/components/dashboard/OverviewHeader'
import QuoteReviewPanel from '@/components/dashboard/QuoteReviewPanel'
import RecentQuotesTable from '@/components/dashboard/RecentQuotesTable'
import SummaryCards from '@/components/dashboard/SummaryCards'
import AppShell from '@/components/shell/AppShell'
import { approveDemoQuote, demoOverview } from '@/lib/dashboard/demoData'
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

function Overview() {
  const [source, setSource] = useState<DataSource>('live')
  const [live, setLive] = useState<OverviewData>(LOADING)
  // Demo data lives in state so demo review actions can change it (on screen only).
  const [demo, setDemo] = useState<OverviewData>(demoOverview)

  // Remember the live/demo choice per browser (a convenience only; defaults to live).
  useEffect(() => {
    try {
      if (localStorage.getItem(SOURCE_KEY) === 'demo') queueMicrotask(() => setSource('demo'))
    } catch {}
  }, [])
  const changeSource = (s: DataSource) => {
    setSource(s)
    try {
      localStorage.setItem(SOURCE_KEY, s)
    } catch {}
  }

  useEffect(() => {
    let cancelled = false
    loadLiveOverview().then((d) => !cancelled && setLive(d))
    return () => {
      cancelled = true
    }
  }, [])

  const data = source === 'demo' ? demo : live

  return (
    <>
      <OverviewHeader source={source} onSourceChange={changeSource} />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        {source === 'demo' && (
          <p className="rounded-[10px] border border-highlight-line bg-highlight px-4 py-2.5 text-highlight-ink">
            You’re viewing <strong>demo data</strong>. These customers and numbers are examples, not your business.
          </p>
        )}

        <SummaryCards summary={data.summary} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
          <div className="min-w-0 space-y-4">
            <QuoteReviewPanel
              reviews={data.reviews}
              onApprove={
                source === 'demo' ? (id, price) => setDemo((d) => approveDemoQuote(d, id, price)) : undefined
              }
            />
            <RecentQuotesTable quotes={data.quotes} source={data.source} />
          </div>
          <div className="min-w-0 space-y-4">
            <WorkflowActivityPanel activity={data.workflowActivity} />
            <RecentActivityPanel events={data.events} />
          </div>
        </div>
      </main>
    </>
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
