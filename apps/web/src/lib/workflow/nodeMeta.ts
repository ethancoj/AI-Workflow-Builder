import type { XYPosition } from '@xyflow/react'
import type { WorkflowNode, WorkflowNodeType } from './types'

type NodeMeta = { label: string; icon: string; color: string; description: string }

// Single source of truth for node display info (sidebar, canvas cards, minimap).
export const NODE_META: Record<WorkflowNodeType, NodeMeta> = {
  start: { label: 'Start', icon: '▶', color: '#16a34a', description: 'Runs when a customer messages you' },
  llm: { label: 'LLM Response', icon: '🤖', color: '#2563eb', description: 'Replies to the customer in your voice' },
  condition: { label: 'Condition', icon: '🔀', color: '#d97706', description: 'Takes a different path depending on what the customer wants' },
  quote: { label: 'Quote', icon: '📷', color: '#7c3aed', description: 'Prices a customer photo using your rubric' },
  end: { label: 'End', icon: '⏹', color: '#dc2626', description: 'Sends the final reply and ends the conversation' },
}

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
