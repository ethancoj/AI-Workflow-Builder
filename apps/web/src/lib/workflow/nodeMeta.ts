import type { XYPosition } from '@xyflow/react'
import type { WorkflowNode, WorkflowNodeType } from './types'

type NodeMeta = { label: string; icon: string; color: string; description: string }

// Merchant-facing names. The saved type keys (llm, condition, quote…) are the runtime
// contract and never change; only these labels do. Report names: LLM Response = AI Reply,
// Condition = Check Message, Quote = Photo Quote.

// Single source of truth for node display info (sidebar, canvas cards, minimap).
export const NODE_META: Record<WorkflowNodeType, NodeMeta> = {
  start: { label: 'Start', icon: '▶', color: '#16a34a', description: 'Runs when a customer messages you' },
  llm: { label: 'AI Reply', icon: '🤖', color: '#2563eb', description: 'Writes a reply to the customer in your voice' },
  condition: { label: 'Check Message', icon: '🔀', color: '#d97706', description: 'Sends the chat down a different path depending on what the customer asks' },
  quote: { label: 'Photo Quote', icon: '📷', color: '#7c3aed', description: 'Prices the customer’s photo using your pricing rubric' },
  end: { label: 'End', icon: '⏹', color: '#dc2626', description: 'Sends a closing message and ends the chat' },
}

// What a customer can want, for “Customer wants to…” paths. Keys are the labels the
// intent classifier returns (to be aligned with the Manglish NLU module); values are what
// the merchant sees.
export const INTENT_LABELS: Record<string, string> = {
  booking: 'book a visit',
  quote_request: 'get a price quote',
  pricing_inquiry: 'ask about prices',
  reschedule: 'change a booking',
  complaint: 'make a complaint',
  greeting: 'just say hello',
}

/** How a path's value reads to the merchant, e.g. “booking” → “book a visit”. */
export const intentLabel = (value: string) => INTENT_LABELS[value.trim()] ?? value.trim().replace(/_/g, ' ')

export const NODE_ORDER: WorkflowNodeType[] = ['start', 'llm', 'condition', 'quote', 'end']

export function isWorkflowNodeType(value: string): value is WorkflowNodeType {
  return (NODE_ORDER as string[]).includes(value)
}

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function createNode(type: WorkflowNodeType, position: XYPosition): WorkflowNode {
  const id = newId(type)
  switch (type) {
    case 'start':
      return { id, type, position, data: { trigger: 'any_message', keywords: [] } }
    case 'llm':
      return { id, type, position, data: { persona: '', instructions: '' } }
    case 'condition':
      return { id, type, position, data: { branches: [{ id: newId('branch'), match: 'intent', value: '' }] } }
    case 'quote':
      return { id, type, position, data: { rubricId: null, rubricName: null } }
    case 'end':
      return { id, type, position, data: { message: '' } }
  }
}
