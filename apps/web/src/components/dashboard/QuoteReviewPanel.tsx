'use client'

import { AlertTriangle, Camera, CheckCircle2, ImageOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatPrice, fullDate, waitingFor } from '@/lib/dashboard/format'
import type { QuoteRow, Section } from '@/lib/dashboard/types'
import { Panel, SectionBody } from './Panel'

export const REVIEW_QUEUE_ID = 'quotes-to-review'
export const REVIEW_TITLE = 'Needs your review'
const SHOWN = 5

/** What just happened in the queue, shown as a short receipt with Undo (demo flow). */
export type ReviewReceipt = { text: string; onUndo: () => void }

/**
 * The quotes the AI wasn't sure about, oldest first (they've waited longest).
 * With `onApprove` (demo data today) the merchant reviews and sends them. Without it (My data,
 * before WhatsApp is connected) these are only test photos, so the panel is informational:
 * no count badge, no attention styling, and each one opens read-only.
 */
export default function QuoteReviewPanel({
  reviews,
  onApprove,
  onAskForPhoto,
  receipt,
}: {
  reviews: Section<QuoteRow[]>
  onApprove?: (id: string, finalPrice: number) => void
  onAskForPhoto?: (id: string) => void
  receipt?: ReviewReceipt | null
}) {
  const canReview = Boolean(onApprove)
  const [reviewing, setReviewing] = useState<QuoteRow | null>(null)
  const [showAll, setShowAll] = useState(false)
  const receiptRef = useRef<HTMLDivElement>(null)

  const rows = reviews.status === 'ready' ? [...reviews.data].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)) : []
  const waiting = canReview && rows.length > 0

  // After an action closes the dialog, its row is gone: put keyboard focus on the receipt
  // (it holds Undo) instead of letting it fall back to the top of the page.
  useEffect(() => {
    if (receipt && !reviewing) receiptRef.current?.focus()
  }, [receipt, reviewing])

  /** The next quote to review after `id`, so the merchant can work through the queue in one go. */
  const nextAfter = (id: string) => {
    const rest = rows.filter((q) => q.id !== id)
    const at = rows.findIndex((q) => q.id === id)
    return rest[at] ?? rest[0] ?? null
  }

  return (
    <Panel
      id={REVIEW_QUEUE_ID}
      title={canReview ? REVIEW_TITLE : 'Test photos the AI wasn’t sure about'}
      count={waiting ? rows.length : undefined}
      // DESIGN.md attention card: grey fill, dark outline, only while something is actually waiting.
      className={waiting ? 'border-highlight-line! bg-highlight!' : ''}
    >
      <details className="group mb-3 text-xs text-muted">
        <summary className="inline-flex min-h-8 cursor-pointer items-center rounded underline-offset-4 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-brand">
          How reviewing works
        </summary>
        <p className="mt-1 max-w-prose">
          The AI prices each customer’s photo with your pricing rubric (your conditions and prices). When it’s sure, the
          quote goes straight to the customer. When it’s less sure than the confidence level you set, the quote waits
          here so you can check the photo, adjust the price and send it, or ask for a clearer photo.
        </p>
      </details>

      {receipt && (
        <div
          ref={receiptRef}
          tabIndex={-1}
          role="status"
          className="animate-arrive mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
          <span className="min-w-0 flex-1 text-ink">{receipt.text}</span>
          <button
            onClick={receipt.onUndo}
            className="min-h-10 rounded px-2 font-semibold text-ink underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-brand"
          >
            Undo
          </button>
        </div>
      )}

      <SectionBody
        section={reviews}
        isEmpty={(r) => r.length === 0}
        empty={
          canReview
            ? 'All caught up. When the AI isn’t sure about a price, the quote waits here for you.'
            : 'None right now. Photos you test on the Pricing Rubric page that the AI isn’t sure about will show here.'
        }
      >
        {() => (
          <>
            <ul className="divide-y divide-divider">
              {(showAll ? rows : rows.slice(0, SHOWN)).map((q) => (
                <QueueRow key={q.id} quote={q} canReview={canReview} onOpen={() => setReviewing(q)} />
              ))}
            </ul>
            {rows.length > SHOWN && (
              <button
                onClick={() => setShowAll(!showAll)}
                className="mt-3 min-h-10 rounded text-sm font-medium text-ink underline underline-offset-4 hover:no-underline focus-visible:ring-2 focus-visible:ring-brand"
              >
                {showAll ? `Show the ${SHOWN} oldest only` : `Show all ${rows.length}`}
              </button>
            )}
            {!canReview && (
              <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-2 text-xs text-muted">
                Nothing here goes to a customer yet. Approving and sending prices starts once WhatsApp is connected. To try
                the review steps now, switch to Demo data at the top.
              </p>
            )}
          </>
        )}
      </SectionBody>

      {reviewing && (
        <ReviewDialog
          key={reviewing.id}
          quote={reviewing}
          position={canReview ? { at: rows.findIndex((q) => q.id === reviewing.id) + 1, of: rows.length } : undefined}
          onClose={() => setReviewing(null)}
          onApprove={
            onApprove
              ? (price) => {
                  const next = nextAfter(reviewing.id)
                  onApprove(reviewing.id, price)
                  setReviewing(next)
                }
              : undefined
          }
          onAskForPhoto={
            onAskForPhoto
              ? () => {
                  const next = nextAfter(reviewing.id)
                  onAskForPhoto(reviewing.id)
                  setReviewing(next)
                }
              : undefined
          }
        />
      )}
    </Panel>
  )
}

/** One waiting quote. Phone: stacked so the condition is never cut off. Wider: one line. */
function QueueRow({ quote: q, canReview, onOpen }: { quote: QuoteRow; canReview: boolean; onOpen: () => void }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0 sm:flex sm:items-center sm:gap-x-4">
      <Thumb quote={q} />
      <div className="min-w-0 sm:flex-1">
        <p className="font-medium text-ink">{q.customer ?? 'Test photo'}</p>
        <p className="text-sm text-muted">{q.level ? `AI thinks: ${q.level}` : q.service}</p>
      </div>
      <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)} className="text-right text-xs text-muted sm:order-last sm:hidden">
        {waitingFor(q.receivedAt)}
      </time>
      <div className="col-span-3 flex items-center justify-between gap-3 sm:contents">
        <div className="sm:text-right">
          <p className="text-xs text-muted">AI price</p>
          <p className="font-semibold tabular-nums text-ink">{formatPrice(q.price)}</p>
        </div>
        <div className="hidden w-16 text-right sm:block">
          <p className="text-xs text-muted">Waiting</p>
          <time dateTime={q.receivedAt} title={fullDate(q.receivedAt)} className="font-medium text-ink">
            {waitingFor(q.receivedAt)}
          </time>
        </div>
        <button
          onClick={onOpen}
          aria-label={`${canReview ? 'Review' : 'Open'} ${q.customer ? `${q.customer}’s quote` : 'this test photo'}`}
          className={`min-h-11 rounded-lg px-4 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
            canReview ? 'bg-brand text-brand-on hover:bg-brand/80' : 'border border-line bg-surface text-ink hover:bg-brand-soft'
          }`}
        >
          {canReview ? 'Review quote' : 'Open'}
        </button>
      </div>
    </li>
  )
}

/** A photo that may fail to load (e.g. an expired link or a missing sample): falls back to a tile. */
function Photo({ src, alt, className, fallback }: { src?: string; alt: string; className: string; fallback: React.ReactNode }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <>{fallback}</>
  // eslint-disable-next-line @next/next/no-img-element -- signed URL to a private photo, not optimisable
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />
}

function Thumb({ quote }: { quote: QuoteRow }) {
  return (
    <Photo
      src={quote.photoUrl}
      alt=""
      className="h-11 w-11 shrink-0 rounded-md border border-line object-cover"
      fallback={
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-divider bg-brand-soft" aria-hidden>
          <Camera className="h-4 w-4 text-muted" />
        </span>
      }
    />
  )
}

/** Suggested final price: the single estimate, or the middle of a range. */
function suggestedPrice(q: QuoteRow): string {
  if (!q.price) return ''
  const { min, max } = q.price
  return String(max !== undefined ? Math.round((min + max) / 2) : min)
}

/** Why the quote is here, in words: the AI's own certainty, not a bare percentage. */
function reasonText(q: QuoteRow): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`
  const sure =
    q.confidence === undefined
      ? ''
      : q.threshold !== undefined
        ? ` It was ${pct(q.confidence)} sure; you send automatically from ${pct(q.threshold)}.`
        : ` It was ${pct(q.confidence)} sure.`
  if (q.confidence !== undefined && q.confidence < 0.4) return `The AI could barely tell the condition from this photo.${sure}`
  return `The AI wasn’t sure enough${q.level ? ` that this is “${q.level}”` : ''} to send the price on its own.${sure}`
}

/** True when the price is far from what the AI suggested, so a typo (RM1500 for RM150) gets a second look. */
function farFromEstimate(value: number, q: QuoteRow): boolean {
  if (!q.price) return false
  const low = q.price.min
  const high = q.price.max ?? q.price.min
  return value < low * 0.5 || value > high * 1.5
}

/**
 * Native <dialog>: focus trapping, Esc to close and a backdrop for free.
 * Without `onApprove` it is read-only (test photos on My data): the evidence, no sending.
 */
function ReviewDialog({
  quote,
  position,
  onClose,
  onApprove,
  onAskForPhoto,
}: {
  quote: QuoteRow
  position?: { at: number; of: number }
  onClose: () => void
  onApprove?: (finalPrice: number) => void
  onAskForPhoto?: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [price, setPrice] = useState(() => suggestedPrice(quote))
  const value = Number(price)
  const valid = price.trim() !== '' && Number.isFinite(value) && value > 0
  const unusual = valid && farFromEstimate(value, quote)
  const isRange = quote.price?.max !== undefined && quote.price.max !== quote.price.min
  const readOnly = !onApprove

  const priceRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    if (window.matchMedia('(min-width: 640px)').matches) priceRef.current?.focus()
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      // React's dev double-run opens, closes, then reopens the dialog; the late "close" event from
      // that first close must not dismiss it, so only react when the dialog really is closed.
      onClose={() => {
        if (!ref.current?.open) onClose()
      }}
      aria-labelledby="review-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100%-2rem))] overflow-y-auto rounded-[10px] border border-line bg-surface p-0 text-sm text-ink backdrop:bg-black/40"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (onApprove && valid) onApprove(Math.round(value))
        }}
      >
        <header className="border-b border-divider px-5 py-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="review-title" tabIndex={-1} autoFocus className="text-base font-semibold outline-none">
              {readOnly ? 'Test photo' : `Review ${quote.customer ? `${quote.customer}’s` : 'this'} quote`}
            </h2>
            {position && position.of > 1 && (
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {position.at} of {position.of}
              </span>
            )}
          </div>
          <p className="text-muted">{quote.service}</p>
        </header>

        <div className="space-y-4 px-5 py-4">
          {/* The evidence: what the customer sent, and what the AI made of it */}
          <div className="flex gap-4">
            <Photo
              src={quote.photoUrl}
              alt="The customer’s photo"
              className="h-28 w-28 shrink-0 rounded-lg border border-line object-cover"
              fallback={
                <span className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-brand-soft px-2 text-center text-[11px] text-muted">
                  <ImageOff className="h-5 w-5" aria-hidden />
                  Photo not available
                </span>
              }
            />
            <dl className="min-w-0 space-y-2">
              <div>
                <dt className="text-xs text-muted">AI thinks the condition is</dt>
                <dd className="font-semibold">{quote.level ?? 'Not sure'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">AI price</dt>
                <dd className="text-lg font-semibold tabular-nums">{formatPrice(quote.price)}</dd>
              </div>
            </dl>
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-highlight px-3 py-2 text-xs text-highlight-ink">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
            {reasonText(quote)}
          </p>
          {quote.reasoning && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted">What the AI saw</p>
              <p className="text-sm text-ink">{quote.reasoning}</p>
            </div>
          )}

          {!readOnly && (
            <div className="space-y-1.5">
              <label htmlFor="final-price" className="font-medium">
                Price to send the customer
              </label>
              <span className="flex items-center rounded-lg border border-line focus-within:ring-2 focus-within:ring-brand">
                <span className="pl-3 text-muted" aria-hidden>
                  RM
                </span>
                <input
                  ref={priceRef}
                  id="final-price"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                  aria-invalid={!valid}
                  aria-describedby="price-help"
                  className="w-full rounded-lg bg-transparent px-2 py-2.5 tabular-nums outline-none"
                />
              </span>
              <p id="price-help" className="text-xs" aria-live="polite">
                {!valid ? (
                  <span className="text-rose-700">Enter a price above RM0.</span>
                ) : unusual ? (
                  <span className="flex items-start gap-1.5 font-medium text-amber-800">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                    RM{Math.round(value)} is far from the AI’s price ({formatPrice(quote.price)}). Check it before sending.
                  </span>
                ) : (
                  <span className="text-muted">
                    {isRange ? 'Filled in with the middle of the AI’s range.' : 'Filled in with the AI’s price.'} Change it if
                    needed.
                  </span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Pinned, so Approve is always reachable when the evidence makes the dialog scroll. */}
        <footer className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-divider bg-surface px-5 py-3">
          {onAskForPhoto && (
            <button
              type="button"
              onClick={onAskForPhoto}
              className="mr-auto min-h-10 rounded-lg px-2 font-medium text-ink underline decoration-line/30 underline-offset-4 hover:decoration-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              Ask for a clearer photo
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-10 rounded-lg border border-line px-3 font-medium hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
          >
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              type="submit"
              disabled={!valid}
              className="min-h-10 rounded-lg bg-brand px-3 font-medium text-brand-on hover:bg-brand/80 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {valid ? `Approve & send RM${Math.round(value)}` : 'Approve & send'}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  )
}
