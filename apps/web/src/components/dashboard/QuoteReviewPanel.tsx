'use client'

import { useEffect, useRef, useState } from 'react'
import { formatPrice, fullDate, waitingFor } from '@/lib/dashboard/format'
import type { QuoteRow, Section } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'

export const REVIEW_QUEUE_ID = 'quotes-to-review'

/**
 * The queue of low-confidence AI quotes. `onApprove` is only passed when a review flow
 * exists for this data (today: demo data). Without it, the action is shown as unavailable.
 */
export default function QuoteReviewPanel({
  reviews,
  onApprove,
}: {
  reviews: Section<QuoteRow[]>
  onApprove?: (id: string, finalPrice: number) => void
}) {
  const [reviewing, setReviewing] = useState<QuoteRow | null>(null)

  return (
    <Panel
      id={REVIEW_QUEUE_ID}
      title="Quotes to review"
      count={reviews.status === 'ready' ? reviews.data.length : undefined}
    >
      <SectionBody
        section={reviews}
        isEmpty={(rows) => rows.length === 0}
        empty="All caught up. Quotes the AI isn’t confident about will wait here for you."
      >
        {(rows) => (
          <>
            <ul className="divide-y divide-divider">
              {rows.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{q.customer ?? 'Test upload'}</p>
                    <p className="text-sm text-muted">{q.service}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">AI estimate</p>
                    <p className="font-semibold tabular-nums text-ink">{formatPrice(q.price)}</p>
                  </div>
                  <div className="w-20 text-right">
                    <p className="text-xs text-muted">Waiting</p>
                    <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)} className="font-medium text-ink">
                      {waitingFor(q.receivedAt)}
                    </time>
                  </div>
                  {onApprove ? (
                    <button
                      onClick={() => setReviewing(q)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-on hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                    >
                      Review quote
                    </button>
                  ) : (
                    <button
                      disabled
                      aria-describedby="review-unavailable"
                      className="cursor-not-allowed rounded-lg border border-divider px-3 py-1.5 text-sm font-medium text-muted"
                    >
                      Review quote
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {!onApprove && (
              <p id="review-unavailable" className="mt-3 text-xs text-muted">
                Reviewing real quotes arrives with the WhatsApp integration. Switch to Demo data to try the review flow.
              </p>
            )}
          </>
        )}
      </SectionBody>

      {reviewing && onApprove && (
        <ReviewDialog
          quote={reviewing}
          onClose={() => setReviewing(null)}
          onApprove={(price) => {
            onApprove(reviewing.id, price)
            setReviewing(null)
          }}
        />
      )}
    </Panel>
  )
}

/** Suggested final price: the single estimate, or the middle of a range. */
function suggestedPrice(q: QuoteRow): string {
  if (!q.price) return ''
  const { min, max } = q.price
  return String(max !== undefined ? Math.round((min + max) / 2) : min)
}

/** Native <dialog>: gives focus trapping, Esc to close and a backdrop for free. */
function ReviewDialog({
  quote,
  onClose,
  onApprove,
}: {
  quote: QuoteRow
  onClose: () => void
  onApprove: (finalPrice: number) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [price, setPrice] = useState(() => suggestedPrice(quote))
  const value = Number(price)
  const valid = price.trim() !== '' && Number.isFinite(value) && value > 0

  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="review-title"
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-[10px] border border-line bg-surface p-0 text-sm text-ink backdrop:bg-black/40"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onApprove(Math.round(value))
        }}
      >
        <header className="border-b border-divider px-5 py-4">
          <h2 id="review-title" className="text-base font-semibold">
            Review quote
          </h2>
          <p className="text-muted">
            {quote.customer ?? 'Test upload'} · {quote.service}
          </p>
        </header>

        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-divider p-3">
              <dt className="text-xs text-muted">AI estimate</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatPrice(quote.price)}</dd>
            </div>
            <div className="rounded-lg border border-divider p-3">
              <dt className="text-xs text-muted">AI confidence</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {quote.confidence !== undefined ? `${Math.round(quote.confidence * 100)}%` : '—'}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted">
            The AI wasn’t confident enough to send this on its own. Check the estimate, adjust it if needed, then approve.
          </p>

          <label className="block space-y-1.5">
            <span className="font-medium">Price to send the customer</span>
            <span className="flex items-center rounded-lg border border-line focus-within:ring-2 focus-within:ring-brand">
              <span className="pl-3 text-muted">RM</span>
              <input
                autoFocus
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                aria-invalid={!valid}
                className="w-full rounded-lg bg-transparent px-2 py-2 tabular-nums outline-none"
              />
            </span>
            {!valid && <span className="block text-xs text-rose-700">Enter a price above RM0.</span>}
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-divider px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 font-medium hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-brand px-3 py-1.5 font-medium text-brand-on hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {valid ? `Approve & send RM${Math.round(value)}` : 'Approve & send'}
          </button>
        </footer>
      </form>
    </dialog>
  )
}
