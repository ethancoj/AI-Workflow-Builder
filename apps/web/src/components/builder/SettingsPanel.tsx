'use client'

import { useReactFlow } from '@xyflow/react'
import { MousePointerClick, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { apiErrorMessage, apiFetch } from '@/lib/api'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { INTENT_LABELS, NODE_META, newId } from '@/lib/workflow/nodeMeta'
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
  'w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

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
        <div className="space-y-3 pt-6 text-center">
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-line" aria-hidden>
            <MousePointerClick className="h-5 w-5 text-ink" />
          </span>
          <p className="text-sm font-medium text-ink">Click a step to change its settings</p>
          <p className="text-xs text-muted">
            Its settings open here. To try your workflow as a customer, use Test chat at the top.
          </p>
        </div>
      ) : (
        // key resets local form state when switching between nodes
        <div key={node.id} className="space-y-5">
          <StepHeader node={node} />

          <NodeForm node={node} />

          <button
            onClick={() => deleteElements({ nodes: [{ id: node.id }] })}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 py-2 text-sm font-medium text-rose-700 hover:border-rose-300 hover:bg-rose-50 focus-visible:ring-2 focus-visible:ring-rose-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete this step
          </button>
        </div>
      )}
    </aside>
  )
}

function StepHeader({ node }: { node: WorkflowNode }) {
  const { Icon, label, description } = NODE_META[node.type]
  return (
    <header className="space-y-2 border-b border-divider pb-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-brand-on" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </h2>
      <p className="text-xs text-muted">{description}</p>
    </header>
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
        <Field label="Keywords" hint="Separate with commas. Capital letters don’t matter.">
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
      <Field label="Who is replying?" hint="Describe your business and how you talk. The AI writes in this style.">
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


function ConditionForm({ node }: { node: ConditionNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<ConditionNode>)
  const removeBranch = useBuilderStore((s) => s.removeConditionBranch)
  const branches = node.data.branches

  const setBranch = (id: string, patch: Partial<ConditionBranch>) =>
    update(node.id, { branches: branches.map((b) => (b.id === id ? { ...b, ...patch } : b)) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Paths are checked from top to bottom and the first match is used. If none match, the chat
        goes down the <span className="text-ink">Otherwise</span> path.
      </p>
      <datalist id="intent-suggestions">
        {Object.entries(INTENT_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </datalist>
      {branches.map((b, i) => (
        <div key={b.id} className="space-y-2 rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">Path {i + 1}</span>
            <button
              onClick={() => removeBranch(node.id, b.id)}
              aria-label={`Remove path ${i + 1}`}
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
            <option value="keyword">Message has the word…</option>
          </select>
          <input
            value={b.value}
            onChange={(e) => setBranch(b.id, { value: e.target.value })}
            list={b.match === 'intent' ? 'intent-suggestions' : undefined}
            placeholder={b.match === 'intent' ? 'Pick from the list, e.g. booking' : 'e.g. bocor'}
            aria-label={b.match === 'intent' ? `Path ${i + 1}: what the customer wants` : `Path ${i + 1}: word to look for`}
            className={inputClass}
          />
          {b.match === 'intent' && b.value.trim() && INTENT_LABELS[b.value.trim()] && (
            <p className="text-xs text-muted">Customer wants to {INTENT_LABELS[b.value.trim()]}</p>
          )}
        </div>
      ))}
      <button
        onClick={() => update(node.id, { branches: [...branches, { id: newId('branch'), match: 'intent', value: '' }] })}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-sm font-medium text-ink hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add a path
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
      <Field label="Pricing rubric" hint="The AI compares the customer’s photo with this rubric to pick a price.">
        {error ? (
          <p role="alert" className="text-xs text-rose-700">
            Couldn&apos;t load your pricing rubrics. Refresh the page to try again. ({error})
          </p>
        ) : !rubrics ? (
          <p className="text-xs text-muted">Loading your pricing rubrics…</p>
        ) : rubrics.length === 0 ? (
          <p className="text-xs text-highlight-ink">
            You haven&apos;t saved a pricing rubric yet. Make one on the{' '}
            <a href="/quotes" target="_blank" className="underline">
              Pricing Rubric page
            </a>{' '}
            and click Save rubric, then come back here.
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
        After the photo, the chat goes one of two ways. <strong className="font-medium text-ink">Quoted</strong>: the AI
        is sure enough and sends the price. <strong className="font-medium text-ink">Needs human review</strong>: the AI
        is less sure than the confidence level in your rubric, so you check the price before the customer gets it.
      </p>
    </div>
  )
}

function EndForm({ node }: { node: EndNode }) {
  const update = useBuilderStore((s) => s.updateNodeData<EndNode>)
  return (
    <Field label="Closing message (optional)" hint="Sent to the customer when the chat reaches this step.">
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
