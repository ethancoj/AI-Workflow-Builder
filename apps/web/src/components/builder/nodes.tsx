'use client'

import { Handle, Position, useUpdateNodeInternals, type NodeProps, type NodeTypes } from '@xyflow/react'
import { useEffect, type ReactNode } from 'react'
import { NODE_META } from '@/lib/workflow/nodeMeta'
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

const handleClass = '!w-3 !h-3 !border-2 !border-white !bg-slate-500'

function NodeCard({
  type,
  selected,
  hasInput,
  children,
}: {
  type: WorkflowNodeType
  selected: boolean
  hasInput: boolean
  children: ReactNode
}) {
  const meta = NODE_META[type]
  return (
    <div
      className="w-60 rounded-lg bg-white text-slate-800 shadow-md"
      style={{ outline: selected ? `3px solid ${meta.color}` : '1px solid #e2e8f0', outlineOffset: selected ? 2 : 0 }}
    >
      {hasInput && <Handle type="target" position={Position.Top} className={handleClass} />}
      <div className="rounded-t-lg px-3 py-2 text-sm font-semibold text-white" style={{ backgroundColor: meta.color }}>
        {meta.icon} {meta.label}
      </div>
      <div className="space-y-1 px-3 py-2 text-xs">{children}</div>
    </div>
  )
}

/** Summary line. Shows an amber "needs setup" hint when the merchant hasn't filled it in. */
function Summary({ text, empty }: { text: string; empty: string }) {
  return text.trim() ? (
    <p className="line-clamp-2 text-slate-600">{text}</p>
  ) : (
    <p className="italic text-amber-600">{empty}</p>
  )
}

/** A labelled output row with its own source handle on the right edge. */
function OutputRow({ id, label, tone = 'text-slate-600' }: { id: string; label: string; tone?: string }) {
  return (
    <div className="relative -mx-3 flex justify-end border-t border-slate-100 px-3 py-1.5">
      <span className={`truncate pr-1 ${tone}`}>{label}</span>
      <Handle type="source" position={Position.Right} id={id} className={handleClass} style={{ right: -6 }} />
    </div>
  )
}

function StartNodeView({ data, selected }: NodeProps<StartNode>) {
  const text =
    data.trigger === 'any_message'
      ? 'Any incoming message'
      : data.keywords.length
        ? `Keywords: ${data.keywords.join(', ')}`
        : ''
  return (
    <NodeCard type="start" selected={selected} hasInput={false}>
      <Summary text={text} empty="Needs setup: add trigger keywords" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </NodeCard>
  )
}

function LlmNodeView({ data, selected }: NodeProps<LlmNode>) {
  return (
    <NodeCard type="llm" selected={selected} hasInput>
      <Summary text={data.persona} empty="Needs setup: no persona" />
      <Summary text={data.instructions} empty="Needs setup: no instructions" />
      <Handle type="source" position={Position.Bottom} className={handleClass} />
    </NodeCard>
  )
}

function ConditionNodeView({ id, data, selected }: NodeProps<ConditionNode>) {
  // Handles are added and removed with branches, so React Flow has to re-measure them.
  const updateNodeInternals = useUpdateNodeInternals()
  const handleKey = data.branches.map((b) => b.id).join('|')
  useEffect(() => updateNodeInternals(id), [id, handleKey, updateNodeInternals])

  return (
    <NodeCard type="condition" selected={selected} hasInput>
      {data.branches.length === 0 && <p className="italic text-amber-600">Needs setup: add a branch</p>}
      {data.branches.map((b) => (
        <OutputRow
          key={b.id}
          id={b.id}
          label={b.value.trim() ? `${b.match === 'intent' ? 'Intent' : 'Keyword'}: ${b.value}` : 'Empty branch'}
          tone={b.value.trim() ? 'text-slate-600' : 'italic text-amber-600'}
        />
      ))}
      <OutputRow id={CONDITION_ELSE_HANDLE} label="Otherwise" tone="text-slate-400" />
    </NodeCard>
  )
}

function QuoteNodeView({ data, selected }: NodeProps<QuoteNode>) {
  return (
    <NodeCard type="quote" selected={selected} hasInput>
      <Summary text={data.rubricName ?? ''} empty="Needs setup: choose a rubric" />
      <OutputRow id={QUOTE_QUOTED_HANDLE} label="✓ Quoted" tone="text-emerald-600" />
      <OutputRow id={QUOTE_ESCALATED_HANDLE} label="⚠ Needs human review" tone="text-rose-600" />
    </NodeCard>
  )
}

function EndNodeView({ data, selected }: NodeProps<EndNode>) {
  return (
    <NodeCard type="end" selected={selected} hasInput>
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
