'use client'

import { Handle, Position, useUpdateNodeInternals, type NodeProps, type NodeTypes } from '@xyflow/react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { NODE_META, intentLabel } from '@/lib/workflow/nodeMeta'
import { useTestRunStore } from '@/lib/workflow/testRunStore'
import { NodeIssueBadge } from './WorkflowChecks'
import {
  CONDITION_ELSE_HANDLE,
  QUOTE_ESCALATED_HANDLE,
  QUOTE_QUOTED_HANDLE,
  type ConditionNode,
  type EndNode,
  type LlmNode,
  type QuoteNode,
  type StartNode,
  type WorkflowNodeType,
} from '@/lib/workflow/types'

// Connection dots: ink on a white ring, a little larger on hover so they're easy to grab.
const handleClass =
  '!h-3 !w-3 !border-2 !border-white !bg-ink transition-transform duration-150 hover:!scale-150'

function NodeCard({
  id,
  type,
  selected,
  hasInput,
  children,
}: {
  id: string
  type: WorkflowNodeType
  selected: boolean
  hasInput: boolean
  children: ReactNode
}) {
  const { Icon, label } = NODE_META[type]
  // Test chat feedback: which steps ran on the last message, and where it's waiting now.
  // Position in the run, so the flash travels along the path the message took.
  const order = useTestRunStore((s) => s.ranNodeIds.indexOf(id))
  const runId = useTestRunStore((s) => s.runId)
  const ran = order >= 0
  const waiting = useTestRunStore((s) => s.waitingNodeId === id)
  return (
    <div
      className={`relative w-60 rounded-[10px] border border-line bg-surface text-ink shadow-sm transition-[box-shadow] duration-200 hover:shadow-md ${
        selected ? 'ring-2 ring-brand ring-offset-2' : ran || waiting ? 'ring-2 ring-brand/70 ring-offset-2' : ''
      }`}
    >
      {ran && <span key={runId} aria-hidden className="step-ran-flash" style={{ animationDelay: `${order * 140}ms` }} />}
      <NodeIssueBadge nodeId={id} />
      {waiting && (
        <span className="animate-pop absolute -top-3 right-2 rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-on">
          Waiting for customer
        </span>
      )}
      {hasInput && <Handle type="target" position={Position.Top} className={handleClass} />}
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand text-brand-on" aria-hidden>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </div>
      <div className="space-y-1 px-3 py-2 text-xs">{children}</div>
    </div>
  )
}

/** Summary line. Shows an amber "needs setup" hint when the merchant hasn't filled it in. */
function Summary({ text, empty }: { text: string; empty: string }) {
  return text.trim() ? (
    <p className="line-clamp-2 text-muted">{text}</p>
  ) : (
    <p className="italic text-amber-700">{empty}</p>
  )
}

/** A labelled output row with its own source handle on the right edge. */
function OutputRow({
  id,
  label,
  tone = 'text-muted',
  icon,
}: {
  id: string
  label: string
  tone?: string
  icon?: ReactNode
}) {
  return (
    <div className="relative -mx-3 flex items-center justify-end gap-1.5 border-t border-divider px-3 py-1.5">
      {icon}
      <span className={`truncate pr-1 ${tone}`}>{label}</span>
      <Handle type="source" position={Position.Right} id={id} className={handleClass} style={{ right: -6 }} />
    </div>
  )
}

function StartNodeView({ id, data, selected }: NodeProps<StartNode>) {
  const text =
    data.trigger === 'any_message'
      ? 'Any message from a customer'
      : data.keywords.length
        ? `Messages with: ${data.keywords.join(', ')}`
        : ''
  return (
    <NodeCard id={id} type="start" selected={selected} hasInput={false}>
      <Summary text={text} empty="Needs setup: add trigger keywords" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </NodeCard>
  )
}

function LlmNodeView({ id, data, selected }: NodeProps<LlmNode>) {
  return (
    <NodeCard id={id} type="llm" selected={selected} hasInput>
      <Summary text={data.persona} empty="Needs setup: who is replying?" />
      <Summary text={data.instructions} empty="Needs setup: what should the reply do?" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </NodeCard>
  )
}

function ConditionNodeView({ id, data, selected }: NodeProps<ConditionNode>) {
  // Handles are added and removed with branches, so React Flow has to re-measure them.
  const updateNodeInternals = useUpdateNodeInternals()
  const handleKey = data.branches.map((b) => b.id).join('|')
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, handleKey, updateNodeInternals])

  return (
    <NodeCard id={id} type="condition" selected={selected} hasInput>
      {data.branches.length === 0 && <p className="italic text-amber-700">Needs setup: add a path</p>}
      {data.branches.map((b) => (
        <OutputRow
          key={b.id}
          id={b.id}
          label={b.value.trim() ? (b.match === 'intent' ? `Wants to: ${intentLabel(b.value)}` : `Has the word: ${b.value.trim()}`) : 'Empty path'}
          tone={b.value.trim() ? 'text-ink' : 'italic text-amber-700'}
        />
      ))}
      <OutputRow id={CONDITION_ELSE_HANDLE} label="Otherwise" tone="text-muted" />
    </NodeCard>
  )
}

function QuoteNodeView({ id, data, selected }: NodeProps<QuoteNode>) {
  return (
    <NodeCard id={id} type="quote" selected={selected} hasInput>
      <Summary text={data.rubricName ?? ''} empty="Needs setup: choose a pricing rubric" />
      <OutputRow
        id={QUOTE_QUOTED_HANDLE}
        label="Quoted"
        tone="text-ink"
        icon={<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />}
      />
      <OutputRow
        id={QUOTE_ESCALATED_HANDLE}
        label="Needs human review"
        tone="font-medium text-ink"
        icon={<AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />}
      />
    </NodeCard>
  )
}

function EndNodeView({ id, data, selected }: NodeProps<EndNode>) {
  return (
    <NodeCard id={id} type="end" selected={selected} hasInput>
      <Summary text={data.message} empty="No closing message (optional)" />
    </NodeCard>
  )
}

// Defined at module level so React Flow gets a stable object (it warns otherwise).
export const nodeTypes: NodeTypes = {
  start: StartNodeView,
  llm: LlmNodeView,
  condition: ConditionNodeView,
  quote: QuoteNodeView,
  end: EndNodeView,
}
