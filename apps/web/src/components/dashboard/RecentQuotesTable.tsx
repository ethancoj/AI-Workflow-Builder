import Link from 'next/link'
import { formatPrice, fullDate, timeAgo } from '@/lib/dashboard/format'
import type { DataSource, QuoteRow, Section } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'
import { REVIEW_QUEUE_ID } from './QuoteReviewPanel'
import StatusBadge from './StatusBadge'

export default function RecentQuotesTable({ quotes, source }: { quotes: Section<QuoteRow[]>; source: DataSource }) {
  return (
    <Panel title="Recent quote requests">
      <SectionBody
        section={quotes}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <p>
            No quote requests yet. Customer photos will appear here once WhatsApp is connected. For now, you can{' '}
            <Link href="/quotes" className="font-medium text-brand-ink underline-offset-2 hover:underline">
              test a photo on the Pricing Rubric page
            </Link>{' '}
            with “Save the photo and result to my Overview” ticked.
          </p>
        }
      >
        {(rows) => (
          <>
          {/* Phone: a list, so price and time are visible without scrolling sideways */}
          <ul className="divide-y divide-divider sm:hidden">
            {rows.map((q) => (
              <li key={q.id} className="space-y-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-medium text-ink">{q.customer ?? <span className="font-normal text-muted">Test photo</span>}</p>
                  <p className="shrink-0 font-medium tabular-nums text-ink">{formatPrice(q.price)}</p>
                </div>
                <p className="truncate text-sm text-muted">{q.service}</p>
                <div className="flex items-center justify-between gap-3">
                  {q.status === 'needs_review' ? (
                        <a href={`#${REVIEW_QUEUE_ID}`} className="rounded-full focus-visible:ring-2 focus-visible:ring-brand" title="Go to the review queue">
                          <StatusBadge status={q.status} />
                        </a>
                      ) : (
                        <StatusBadge status={q.status} />
                      )}
                  <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)} className="text-xs text-muted">
                    {timeAgo(q.receivedAt)}
                  </time>
                </div>
              </li>
            ))}
          </ul>
          <div className="-mx-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Most recent quote requests</caption>
              <thead className="text-xs text-muted">
                <tr className="border-b border-divider">
                  <th scope="col" className="px-4 pb-2 font-medium">Customer</th>
                  <th scope="col" className="px-4 pb-2 font-medium">Service</th>
                  <th scope="col" className="px-4 pb-2 font-medium">Status</th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium">Price</th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {q.customer ?? (
                        <span className="font-normal text-muted" title={source === 'live' ? 'Uploaded on the Pricing Rubric test page' : undefined}>
                          Test photo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{q.service}</td>
                    <td className="px-4 py-3">
                      {q.status === 'needs_review' ? (
                        <a href={`#${REVIEW_QUEUE_ID}`} className="rounded-full focus-visible:ring-2 focus-visible:ring-brand" title="Go to the review queue">
                          <StatusBadge status={q.status} />
                        </a>
                      ) : (
                        <StatusBadge status={q.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-ink">{formatPrice(q.price)}</td>
                    <td className="px-4 py-3 text-right text-muted">
                      <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)}>
                        {timeAgo(q.receivedAt)}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </SectionBody>
    </Panel>
  )
}
