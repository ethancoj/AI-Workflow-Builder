'use client'

import { useReactFlow } from '@xyflow/react'
import { useEffect, useState, type ReactNode } from 'react'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { NODE_META, newId } from '@/lib/workflow/nodeMeta'
import type {
  ConditionBranch,
  ConditionNode,
  EndNode,
  LlmNode,
  QuoteNode,
  StartNode,
  WorkflowNode,
} from '@/lib/workflow/types'

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-muted focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20'

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export default function SettingsPanel() {
  // Returns the node object itself (not a new one), so this selector is render-stable.
  const node = useBuilderStore((s) => {
    const selected = s.nodes.filter((n) => n.selected)
    return selected.length === 1 ? selected[0] : null
  })
  const { deleteElements } = useReactFlow()

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-line bg-surface p-5 text-ink md:flex lg:w-80">
      {!node ? (
        <p className="text-sm text-muted">Click a node on the canvas to edit its settings.</p>
      ) : (
        // key resets local form state when switching between nodes
        <div key={node.id} className="space-y-5">
          <header className="space-y-1">
            <h2 className="text-base font-semibold" style={{ color: NODE_META[node.type].color }}>
              {NODE_META[node.type].icon} {NODE_META[node.type].label}
            </h2>
            <p className="text-xs text-muted">{NODE_META[node.type].description}</p>
          </header>

          <NodeForm node={node} />

          <button
            onClick={() => deleteElements({ nodes: [{ id: node.id }] })}
            className="w-full rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
          >
            Delete node
          </button>
        </div>
      )}
    </aside>
  )
}

function NodeForm({ node }: { node: WorkflowNode }) {
  switch (node.type) {
    case 'start':
      return <StartForm node={node} />
    case 'llm':
      return <LlmForm node={node} />
    case 'condition':
      return <ConditionForm node={node} />
    case 'quote':
      return <QuoteForm node={node} />
    case 'end':
      return <EndForm node={node} />
  }
}

function StartForm({ node }: { node: StartNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<StartNode>)
  // Kept as raw text so typing a trailing comma isn't immediately stripped.
  const [keywordText, setKeywordText] = useState(node.data.keywords.join(', '))

  return (
    <div className="space-y-4">
      <Field label="Start this workflow when…">
        <select
          value={node.data.trigger}
          onChange={(e) => update(node.id, { trigger: e.target.value as StartNode['data']['trigger'] })}
          className={inputClass}
        >
          <option value="any_message">A customer sends any message</option>
          <option value="keyword">A message contains a keyword</option>
        </select>
      </Field>
      {node.data.trigger === 'keyword' && (
        <Field label="Keywords" hint="Separate with commas. Matching ignores upper/lower case.">
          <input
            value={keywordText}
            onChange={(e) => {
              setKeywordText(e.target.value)
              update(node.id, {
                keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
              })
            }}
            placeholder="e.g. aircon, servis, quote"
            className={inputClass}
          />
        </Field>
      )}
    </div>
  )
}

function LlmForm({ node }: { node: LlmNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<LlmNode>)
  return (
    <div className="space-y-4">
      <Field label="Who is replying?" hint="Describe your business voice. The AI will write in this style.">
        <textarea
          rows={3}
          value={node.data.persona}
          onChange={(e) => update(node.id, { persona: e.target.value })}
          placeholder="e.g. Friendly aircon technician in KL who replies in casual Manglish"
          className={inputClass}
        />
      </Field>
      <Field label="What should the reply do?" hint="Plain instructions, like you'd give a new staff member.">
        <textarea
          rows={5}
          value={node.data.instructions}
          onChange={(e) => update(node.id, { instructions: e.target.value })}
          placeholder="e.g. Greet the customer, ask what's wrong with their aircon, and ask which area they're in."
          className={inputClass}
        />
      </Field>
    </div>
  )
}

// Suggested values only. The final intent list must match what the Manglish NLU module (Obj 2) outputs.
const INTENT_SUGGESTIONS = ['booking', 'quote_request', 'pricing_inquiry', 'reschedule', 'complaint', 'greeting']

function ConditionForm({ node }: { node: ConditionNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<ConditionNode>)
  const removeBranch = useBuilderStore((s) => s.removeConditionBranch)
  const branches = node.data.branches

  const setBranch = (id: string, patch: Partial<ConditionBranch>) =>
    update(node.id, { branches: branches.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Each branch is checked in order, top to bottom. The first match wins. If nothing matches, the
        <span className="text-ink"> Otherwise</span> path is used.
      </p>
      <datalist id="intent-suggestions">
        {INTENT_SUGGESTIONS.map((i) => (
          <option key={i} value={i} />
        ))}
      </datalist>
      {branches.map((b, i) => (
        <div key={b.id} className="space-y-2 rounded-md border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">Branch {i + 1}</span>
            <button
              onClick={() => removeBranch(node.id, b.id)}
              className="text-xs text-muted hover:text-rose-700"
            >
              Remove
            </button>
          </div>
          <select
            value={b.match}
            onChange={(e) => setBranch(b.id, { match: e.target.value as ConditionBranch['match'] })}
            className={inputClass}
          >
            <option value="intent">Customer wants to…</option>
            <option value="keyword">Message contains the word…</option>
          </select>
          <input
            value={b.value}
            onChange={(e) => setBranch(b.id, { value: e.target.value })}
            list={b.match === 'intent' ? 'intent-suggestions' : undefined}
            placeholder={b.match === 'intent' ? 'e.g. booking' : 'e.g. bocor'}
            className={inputClass}
          />
        </div>
      ))}
      <button
        onClick={() => update(node.id, { branches: [...branches, { id: newId('branch'), match: 'intent', value: '' }] })}
        className="w-full rounded-md border border-dashed border-line py-2 text-sm text-ink hover:border-teal"
      >
        + Add branch
      </button>
    </div>
  )
}

type RubricOption = { id: string; name: string }

function QuoteForm({ node }: { node: QuoteNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<QuoteNode>)
  const [rubrics, setRubrics] = useState<RubricOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/quotes/rubrics')
      .then(async (res) => {
        if (!res.ok) throw new Error(await apiErrorMessage(res))
        return (await res.json()) as RubricOption[]
      })
      .then((data) => !cancelled && setRubrics(data))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Unknown error'))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-4">
      <Field label="Pricing rubric" hint="The AI compares the customer's photo against this rubric to pick a price.">
        {error ? (
          <p className="text-xs text-rose-700">
            Couldn&apos;t load rubrics ({error}). Check that the API server is running.
          </p>
        ) : !rubrics ? (
          <p className="text-xs text-muted">Loading rubrics…</p>
        ) : rubrics.length === 0 ? (
          <p className="text-xs text-amber-ink">
            No saved rubrics yet. Create one on the{' '}
            <a href="/quotes" target="_blank" className="underline">
              Quotes page
            </a>{' '}
            and click Save rubric.
          </p>
        ) : (
          <select
            value={node.data.rubricId ?? ''}
            onChange={(e) => {
              const picked = rubrics.find((r) => r.id === e.target.value)
              update(node.id, { rubricId: picked?.id ?? null, rubricName: picked?.name ?? null })
            }}
            className={inputClass}
          >
            <option value="">Choose a rubric…</option>
            {rubrics.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}
      </Field>
      <p className="text-xs text-muted">
        This node has two exits. <span className="text-emerald-700">Quoted</span> is used when the AI is confident.{' '}
        <span className="text-rose-700">Needs human review</span> is used when its confidence is below the
        rubric&apos;s escalation threshold.
      </p>
    </div>
  )
}

function EndForm({ node }: { node: EndNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<EndNode>)
  return (
    <Field label="Closing message (optional)" hint="Sent to the customer when the conversation reaches this point.">
      <textarea
        rows={4}
        value={node.data.message}
        onChange={(e) => update(node.id, { message: e.target.value })}
        placeholder="e.g. Terima kasih! We'll WhatsApp you to confirm the slot."
        className={inputClass}
      />
    </Field>
  )
}
