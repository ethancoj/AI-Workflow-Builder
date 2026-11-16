import type { Edge, Node } from '@xyflow/react'

// Shape of a saved workflow. The FastAPI translation layer reads this JSON,
// so treat field names here as a contract: bump WorkflowJson.version on breaking changes.

export type WorkflowNodeType = 'start' | 'llm' | 'condition' | 'quote' | 'end'

export type StartData = {
  trigger: 'any_message' | 'keyword'
  keywords: string[]
}

export type LlmData = {
  persona: string
  instructions: string
}

export type ConditionBranch = {
  id: string // also the React Flow source handle id for this branch
  match: 'intent' | 'keyword'
  value: string
}

export type ConditionData = {
  branches: ConditionBranch[]
}

export type QuoteData = {
  rubricId: string | null
  rubricName: string | null // display copy; rubricId is the source of truth
}

export type EndData = {
  message: string
}

export type StartNode = Node<StartData, 'start'>
export type LlmNode = Node<LlmData, 'llm'>
export type ConditionNode = Node<ConditionData, 'condition'>
export type QuoteNode = Node<QuoteData, 'quote'>
export type EndNode = Node<EndData, 'end'>

export type WorkflowNode = StartNode | LlmNode | ConditionNode | QuoteNode | EndNode

export type WorkflowJson = {
  version: 1
  nodes: WorkflowNode[]
  edges: Edge[]
}

// Fixed source handle ids. Edges store these in `sourceHandle`, which tells
// the runtime which path to take out of a node.
export const CONDITION_ELSE_HANDLE = 'else'
export const QUOTE_QUOTED_HANDLE = 'quoted'
export const QUOTE_ESCALATED_HANDLE = 'escalated'
