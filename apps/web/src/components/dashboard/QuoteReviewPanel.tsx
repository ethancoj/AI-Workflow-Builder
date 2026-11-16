import { formatPrice, timeAgo } from '@/lib/dashboard/format'
import type { QuoteRow, Section } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'

export default function QuoteReviewPanel({ reviews }: { reviews: Section<QuoteRow[]> }) {
  return (
    <Panel title="Needs Your Review">
      <SectionBody
        section={reviews}
        isEmpty={(rows) => rows.length === 0}
        empty="Nothing to review. Quotes the AI isn’t confident about will show up here."
      >
        {(rows) => (
          <>
            <ul className="divide-y divide-line">
              {rows.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{q.customer ?? 'Test upload'}</p>
                    <p className="text-sm text-muted">
                      {q.service} · {timeAgo(q.receivedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">AI estimate</p>
                    <p className="font-semibold tabular-nums text-ink">
                      {formatPrice(q.price)}
                      {q.confidence !== undefined && (
                        <span className="ml-1.5 text-xs font-normal text-amber-ink">
                          {Math.round(q.confidence * 100)}% sure
                        </span>
                      )}
                    </p>
                  </div>
                  {/* The approve/edit flow isn't built yet, so the action is visibly unavailable. */}
                  <button
                    disabled
                    aria-describedby="review-unavailable"
                    className="cursor-not-allowed rounded-lg bg-teal/40 px-3 py-1.5 text-sm font-medium text-white"
                  >
                    Review quote
                  </button>
                </li>
              ))}
            </ul>
            <p id="review-unavailable" className="mt-3 text-xs text-muted">
              Reviewing, editing and approving quotes is coming soon.
            </p>
          </>
        )}
      </SectionBody>
    </Panel>
  )
}
