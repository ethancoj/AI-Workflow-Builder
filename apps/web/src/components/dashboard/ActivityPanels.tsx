import { AlertTriangle, Calculator, CalendarCheck, FileText, MessageCircle, Workflow, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { fullDate, timeAgo } from '@/lib/dashboard/format'
import type { ActivityEvent, Section, WorkflowActivity } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'

export function WorkflowActivityPanel({ activity }: { activity: Section<WorkflowActivity> }) {
  return (
    <Panel
      title="Workflow activity"
      action={
        <Link href="/builder" className="inline-flex min-h-10 items-center text-xs font-medium text-brand-ink underline-offset-2 hover:underline">
          Open builder
        </Link>
      }
    >
      <SectionBody
        section={activity}
        isEmpty={(a) => (a.kind === 'stages' ? a.stages.length === 0 : a.workflows.length === 0)}
        empty={
          <p>
            No workflows yet.{' '}
            <Link href="/builder" className="font-medium text-brand-ink hover:underline">
              Create your first workflow
            </Link>
            .
          </p>
        }
      >
        {(a) => (a.kind === 'stages' ? <StageBars stages={a.stages} /> : <WorkflowList workflows={a.workflows} />)}
      </SectionBody>
    </Panel>
  )
}

/** Conversation counts per stage: the number is always shown, the bar is only a visual aid. */
function StageBars({ stages }: { stages: { name: string; count: number }[] }) {
  const max = Math.max(...stages.map((s) => s.count), 1)
  return (
    <ul className="space-y-3">
      {stages.map((s) => (
        <li key={s.name}>
          <div className="flex justify-between text-sm">
            <span className="text-ink">{s.name}</span>
            <span className="font-medium tabular-nums text-ink">{s.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-brand-soft" aria-hidden>
            <div className="h-2 rounded-full bg-brand" style={{ width: `${(s.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function WorkflowList({ workflows }: { workflows: { id: string; name: string; createdAt: string; openable: boolean }[] }) {
  return (
    <>
      <ul className="divide-y divide-divider">
        {workflows.map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{w.name}</p>
              <p className="text-xs text-muted">Created {timeAgo(w.createdAt)}</p>
            </div>
            {w.openable ? (
              <Link
                href={`/builder?id=${w.id}`}
                className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-line px-3 text-xs font-medium text-ink hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
              >
                Open
              </Link>
            ) : (
              <span className="shrink-0 text-xs text-muted" title="Saved in an older format">
                Old format
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Conversation stats per stage will appear once WhatsApp is connected.</p>
    </>
  )
}

const EVENT_ICON: Record<ActivityEvent['kind'], LucideIcon> = {
  quote: FileText,
  review: AlertTriangle,
  workflow: Workflow,
  rubric: Calculator,
  message: MessageCircle,
  booking: CalendarCheck,
}

export function RecentActivityPanel({ events }: { events: Section<ActivityEvent[]> }) {
  return (
    <Panel title="Recent activity">
      <SectionBody section={events} isEmpty={(e) => e.length === 0} empty="No activity yet.">
        {(list) => (
          <ol className="divide-y divide-divider">
            {list.map((e) => {
              const Icon = EVENT_ICON[e.kind]
              return (
                <li key={e.id} className="flex gap-3 py-3 text-sm first:pt-0 last:pb-0">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${e.kind === 'review' ? 'text-amber-700' : 'text-brand-ink'}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-ink">{e.text}</p>
                    <time dateTime={e.at} title={fullDate(e.at)} className="text-xs text-muted">
                      {timeAgo(e.at)}
                    </time>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </SectionBody>
    </Panel>
  )
}
