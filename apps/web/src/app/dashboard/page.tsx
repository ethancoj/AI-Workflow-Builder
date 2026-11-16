'use client'

import { useCallback, useEffect, useState } from 'react'
import RequireAuth, { useSession } from '@/components/auth/RequireAuth'
import { RecentActivityPanel, WorkflowActivityPanel } from '@/components/dashboard/ActivityPanels'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'
import OverviewHeader from '@/components/dashboard/OverviewHeader'
import QuoteReviewPanel from '@/components/dashboard/QuoteReviewPanel'
import RecentQuotesTable from '@/components/dashboard/RecentQuotesTable'
import SummaryCards from '@/components/dashboard/SummaryCards'
import { demoOverview } from '@/lib/dashboard/demoData'
import { loadLiveOverview } from '@/lib/dashboard/liveData'
import type { DataSource, OverviewData } from '@/lib/dashboard/types'
import { supabase } from '@/lib/supabase'

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
  const session = useSession()
  const [source, setSource] = useState<DataSource>('live')
  const [live, setLive] = useState<OverviewData>(LOADING)
  const [merchantName, setMerchantName] = useState<string>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

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
    supabase
      .from('merchants')
      .select('name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => !cancelled && data?.name && setMerchantName(data.name))
    return () => {
      cancelled = true
    }
  }, [session.user.id])

  const data = source === 'demo' ? demoOverview() : live

  return (
    // Overview is pinned to the light palette even when the OS is in dark mode.
    <div className="theme-light flex min-h-screen bg-page text-sm text-ink">
      <DashboardSidebar active="/dashboard" drawerOpen={drawerOpen} onCloseDrawer={closeDrawer} />

      <div className="flex min-w-0 flex-1 flex-col">
        <OverviewHeader
          source={source}
          onSourceChange={changeSource}
          merchantName={merchantName}
          onOpenNav={() => setDrawerOpen(true)}
        />

        <main className="flex-1 space-y-4 p-4 md:p-6">
          {source === 'demo' && (
            <p className="rounded-[10px] border border-amber-line bg-amber-tint px-4 py-2.5 text-amber-ink">
              You’re viewing <strong>demo data</strong>. These customers and numbers are examples, not your business.
            </p>
          )}

          <SummaryCards summary={data.summary} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
            <div className="min-w-0 space-y-4">
              <RecentQuotesTable quotes={data.quotes} source={data.source} />
              <QuoteReviewPanel reviews={data.reviews} />
            </div>
            <div className="min-w-0 space-y-4">
              <WorkflowActivityPanel activity={data.workflowActivity} />
              <RecentActivityPanel events={data.events} />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Overview />
    </RequireAuth>
  )
}
