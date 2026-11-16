'use client'

import { ImagePlus, RotateCcw, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { useTestRunStore } from '@/lib/workflow/testRunStore'
import { useIssues } from './WorkflowChecks'

// Mirrors the response of POST /api/runtime/test (apps/api/routers/runtime.py).
type QuoteOutcome = { level_name: string; price: number; confidence: number; escalated: boolean; reasoning: string }
type BotReply = { text: string; kind: 'text' | 'quote' | 'escalation' | 'fallback'; quote: QuoteOutcome | null }
type TraceStep = { node_id: string; node_type: string; note: string }
type RunState = { node: string | null; history: { role: string; text: string }[] }
type TurnResponse = {
  replies: BotReply[]
  state: RunState
  trace: TraceStep[]
  finished: boolean
  started: boolean
  needs_follow_up: boolean
}

type ChatItem =
  | { id: number; from: 'customer'; text: string; photoUrl?: string }
  | { id: number; from: 'bot'; reply: BotReply; trace?: TraceStep[] }
  | { id: number; from: 'system'; text: string; tone?: 'error' | 'warning'; trace?: TraceStep[] }

let nextId = 1

export default function TestChat() {
  const setOpen = useTestRunStore((s) => s.setOpen)
  const showRun = useTestRunStore((s) => s.showRun)
  const clearRun = useTestRunStore((s) => s.clearRun)

  const problems = useIssues().filter((i) => i.severity === 'error')
  const [items, setItems] = useState<ChatItem[]>([])
  const [runState, setRunState] = useState<RunState | null>(null)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [showSteps, setShowSteps] = useState(true)
  const fileInput = useRef<HTMLInputElement>(null)
  const listEnd = useRef<HTMLDivElement>(null)

  // Keep the newest message in view. (Braces: an effect may only return a clean-up function.)
  useEffect(() => {
    listEnd.current?.scrollIntoView({ block: 'end' })
  }, [items, busy])

  const add = (...more: ChatItem[]) => setItems((prev) => [...prev, ...more])

  const restart = () => {
    setItems([])
    setRunState(null)
    clearRun()
  }

  const send = async () => {
    if (busy || (!text.trim() && !photo)) return
    const sentText = text.trim()
    const sentPhoto = photo
    add({ id: nextId++, from: 'customer', text: sentText, photoUrl: sentPhoto ? URL.createObjectURL(sentPhoto) : undefined })
    setText('')
    setPhoto(null)
    setBusy(true)

    const fd = new FormData()
    // The canvas as it is right now, so unsaved edits can be tested.
    fd.append('flow_json', JSON.stringify(useBuilderStore.getState().toWorkflowJson()))
    if (runState) fd.append('state_json', JSON.stringify(runState))
    fd.append('text', sentText)
    if (sentPhoto) fd.append('image', sentPhoto)

    try {
      const res = await apiFetch('/api/runtime/test', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await apiErrorMessage(res))
      const turn: TurnResponse = await res.json()

      setRunState(turn.state)
      showRun([...new Set(turn.trace.map((t) => t.node_id))], turn.state.node)

      if (!turn.started) {
        add({ id: nextId++, from: 'system', text: 'The workflow didn’t start: this message has none of the Start step’s keywords.', trace: turn.trace })
      }
      turn.replies.forEach((reply, i) =>
        add({ id: nextId++, from: 'bot', reply, trace: i === turn.replies.length - 1 ? turn.trace : undefined }),
      )
      if (turn.needs_follow_up) {
        add({
          id: nextId++,
          from: 'system',
          tone: 'warning',
          text:
            'Your workflow had no reply for this message, so the safety-net reply was sent. With real customers the chat ' +
            'is flagged for you to follow up. Check the steps above to close the gap.',
        })
      }
      if (turn.finished) {
        add({ id: nextId++, from: 'system', text: 'Conversation finished. The next message starts the workflow again.' })
      }
    } catch (e) {
      add({ id: nextId++, from: 'system', tone: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-line bg-surface text-ink lg:w-96" aria-label="Test chat">
      <header className="flex items-start gap-2 border-b border-divider px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Test chat</h2>
          <p className="text-xs text-muted">
            Chat as a customer with the workflow on the canvas, unsaved changes included. Uses the real AI; nothing is sent
            to customers.
          </p>
        </div>
        <button
          onClick={restart}
          title="Start a new conversation"
          aria-label="Start a new conversation"
          className="rounded-md p-1.5 text-muted hover:bg-brand-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close test chat"
          className="rounded-md p-1.5 text-muted hover:bg-brand-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {problems.length > 0 && (
        <p role="status" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">
          <strong>
            {problems.length} problem{problems.length === 1 ? '' : 's'} to fix first:
          </strong>{' '}
          {problems[0].title}
          {problems.length > 1 && ' and more. See the checks button above the canvas.'}
        </p>
      )}
      <div className="flex-1 space-y-3 overflow-y-auto bg-page px-4 py-4" aria-live="polite">
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-divider p-3 text-center text-xs text-muted">
            Type a message like a customer would, e.g. “Hi, my aircon is leaking”. You can also attach a photo for a Quote
            step.
          </p>
        )}
        {items.map((item) => (
          <ChatBubble key={item.id} item={item} showSteps={showSteps} />
        ))}
        {busy && <p className="text-xs text-muted">Workflow is running…</p>}
        <div ref={listEnd} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="space-y-2 border-t border-divider p-3"
      >
        {photo && (
          <div className="flex items-center gap-2 rounded-lg border border-divider px-2 py-1.5 text-xs">
            <span className="min-w-0 flex-1 truncate">📷 {photo.name}</span>
            <button type="button" onClick={() => setPhoto(null)} className="text-muted hover:text-ink">
              Remove
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              setPhoto(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            title="Attach a photo"
            aria-label="Attach a photo"
            className="rounded-lg border border-line p-2 hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
          </button>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message as the customer…"
            aria-label="Customer message"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <button
            type="submit"
            disabled={busy || (!text.trim() && !photo)}
            aria-label="Send"
            className="rounded-lg bg-brand p-2 text-brand-on hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} className="accent-brand" />
          Show which steps ran
        </label>
      </form>
    </aside>
  )
}

function ChatBubble({ item, showSteps }: { item: ChatItem; showSteps: boolean }) {
  if (item.from === 'system') {
    if (item.tone === 'warning') {
      return (
        <div className="space-y-1 rounded-lg border border-dashed border-line bg-surface px-3 py-2 text-xs">
          <p className="font-semibold text-ink">⚠ {item.text}</p>
          {item.trace && <Steps trace={item.trace} />}
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <p
          role={item.tone === 'error' ? 'alert' : undefined}
          className={`text-center text-xs ${item.tone === 'error' ? 'text-rose-700' : 'text-muted'}`}
        >
          {item.text}
        </p>
        {showSteps && item.trace && item.trace.length > 0 && <Steps trace={item.trace} />}
      </div>
    )
  }

  if (item.from === 'customer') {
    return (
      <div className="ml-8 flex flex-col items-end gap-1">
        {item.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local preview of an uploaded file
          <img src={item.photoUrl} alt="Photo sent by the customer" className="max-h-40 rounded-lg border border-line" />
        )}
        {item.text && <p className="rounded-lg rounded-br-sm bg-brand px-3 py-2 text-brand-on">{item.text}</p>}
      </div>
    )
  }

  const { reply, trace } = item
  return (
    <div className="mr-8 space-y-1">
      <div
        className={`rounded-lg rounded-bl-sm border bg-surface px-3 py-2 ${reply.kind === 'fallback' ? 'border-dashed border-line' : 'border-line'}`}
      >
        <p className="whitespace-pre-wrap">{reply.text}</p>
        {reply.kind === 'fallback' && (
          <p className="mt-2 border-t border-divider pt-2 text-xs font-semibold text-ink">Safety-net reply</p>
        )}
        {reply.quote && (
          <p className="mt-2 border-t border-divider pt-2 text-xs text-muted">
            {reply.kind === 'escalation' ? (
              <strong className="text-ink">Needs human review</strong>
            ) : (
              <strong className="text-ink">AI quote</strong>
            )}{' '}
            · {reply.quote.level_name}
            {reply.quote.price > 0 && ` · RM${Math.round(reply.quote.price)}`} · {Math.round(reply.quote.confidence * 100)}%
            confident
          </p>
        )}
      </div>
      {showSteps && trace && trace.length > 0 && <Steps trace={trace} />}
    </div>
  )
}

function Steps({ trace }: { trace: TraceStep[] }) {
  return (
    <ol className="space-y-0.5 pl-1 text-[11px] text-muted">
      {trace.map((t, i) => (
        <li key={i}>
          <span className="font-medium capitalize text-ink">{t.node_type === 'llm' ? 'LLM' : t.node_type}</span>: {t.note}
        </li>
      ))}
    </ol>
  )
}
