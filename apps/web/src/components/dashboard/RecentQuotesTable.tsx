import Link from 'next/link'
import { formatPrice, fullDate, timeAgo } from '@/lib/dashboard/format'
import type { DataSource, QuoteRow, Section } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'
import StatusBadge from './StatusBadge'

export default function RecentQuotesTable({ quotes, source }: { quotes: Section<QuoteRow[]>; source: DataSource }) {
  return (
    <Panel title="Recent Quote Requests">
      <SectionBody
        section={quotes}
        isEmpty={(rows) => rows.length === 0}
        empty={
          <p>
            No quote requests yet. Customer photos will appear here once WhatsApp is connected. For now, you can{' '}
            <Link href="/quotes" className="font-medium text-brand-ink underline-offset-2 hover:underline">
              test a photo on the Pricing Rubric page
            </Link>{' '}
            with “Save to my dashboard” ticked.
          </p>
        }
      >
        {(rows) => (
          // The table scrolls inside its own panel on narrow screens instead of the whole page.
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <caption className="sr-only">Most recent quote requests</caption>
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-divider">
                  <th scope="col" className="px-4 pb-2 font-medium">Customer</th>
                  <th scope="col" className="px-4 pb-2 font-medium">Service</th>
                  <th scope="col" className="px-4 pb-2 font-medium">Status</th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium">Est. Price</th>
                  <th scope="col" className="px-4 pb-2 text-right font-medium">Received</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => (
                  <tr key={q.id} className="border-b border-divider last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">
                      {q.customer ?? (
                        <span className="font-normal text-muted" title="Uploaded on the Pricing Rubric test page">
                          {source === 'live' ? 'Test upload' : 'Unknown'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink">{q.service}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={q.status} />
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
        )}
      </SectionBody>
    </Panel>
  )
}
