import type { Edge } from '@xyflow/react'
import { newId } from './nodeMeta'
import {
  CONDITION_ELSE_HANDLE,
  QUOTE_ESCALATED_HANDLE,
  QUOTE_QUOTED_HANDLE,
  type WorkflowJson,
  type WorkflowNode,
} from './types'

// Ready-made starting workflows (FR1.5). They produce ordinary WorkflowJson, so the merchant
// edits them on the canvas like anything they built themselves.

export type TemplateRubric = { id: string; name: string } | null

const PERSONA = 'Friendly and helpful staff at a small local service business'

/**
 * Photo quote chatbot: greet → photo quote (your rubric) → offer a booking.
 *   Start → greet & ask for a photo → Photo Quote
 *     Quoted              → Check reply: "book a visit" → ask for booking details → confirm → End
 *                                        otherwise     → answer the question → End
 *     Needs human review  → End (the quote step already told the customer the team will check)
 * With no rubric, the Photo Quote step is left for the merchant to pick one (the checks flag it).
 */
export function photoQuoteTemplate(rubric: TemplateRubric, service = 'aircon'): { name: string; flow: WorkflowJson } {
  const id = {
    start: 'start-1',
    greet: newId('llm'),
    quote: newId('quote'),
    check: newId('condition'),
    booking: newId('branch'),
    askDetails: newId('llm'),
    confirm: newId('llm'),
    answer: newId('llm'),
    endBooked: newId('end'),
    endAnswered: newId('end'),
    endReview: newId('end'),
  }
  // Columns are 240px cards; Start is a narrower 144px chip, so it's shifted to line up.
  const COL = 300
  const ROW = 170
  const nodes: WorkflowNode[] = [
    { id: id.start, type: 'start', position: { x: 48, y: 0 }, data: { trigger: 'any_message', keywords: [] } },
    {
      id: id.greet,
      type: 'llm',
      position: { x: 0, y: ROW * 0.8 },
      data: {
        persona: PERSONA,
        instructions: `Greet the customer and thank them for messaging. Ask them to send a clear photo of the ${service} they need help with, so we can estimate the price. Keep it short.`,
      },
    },
    {
      id: id.quote,
      type: 'quote',
      position: { x: 0, y: ROW * 2 },
      data: { rubricId: rubric?.id ?? null, rubricName: rubric?.name ?? null },
    },
    {
      id: id.check,
      type: 'condition',
      position: { x: -COL / 2, y: ROW * 3.2 },
      data: { branches: [{ id: id.booking, match: 'intent', value: 'booking' }] },
    },
    {
      id: id.askDetails,
      type: 'llm',
      position: { x: -COL, y: ROW * 4.3 },
      data: {
        persona: PERSONA,
        instructions:
          'The customer wants to book a visit. Ask for their preferred date and time, and their address. Only ask for details they haven’t given yet.',
      },
    },
    {
      id: id.confirm,
      type: 'llm',
      position: { x: -COL, y: ROW * 5.5 },
      data: {
        persona: PERSONA,
        instructions:
          'Thank the customer and repeat back the booking details they gave. Say our team will confirm the appointment on WhatsApp shortly.',
      },
    },
    { id: id.endBooked, type: 'end', position: { x: -COL, y: ROW * 6.6 }, data: { message: '' } },
    {
      id: id.answer,
      type: 'llm',
      position: { x: 0, y: ROW * 4.3 },
      data: {
        persona: PERSONA,
        instructions:
          'Answer the customer’s question about the quote or the service. If you don’t know something, say our team will get back to them. End by asking if they’d like to book a visit.',
      },
    },
    { id: id.endAnswered, type: 'end', position: { x: 0, y: ROW * 5.5 }, data: { message: '' } },
    { id: id.endReview, type: 'end', position: { x: COL, y: ROW * 3.2 }, data: { message: '' } },
  ]

  const edge = (source: string, target: string, sourceHandle: string | null = null): Edge => ({
    id: newId('edge'),
    source,
    target,
    sourceHandle,
    targetHandle: null,
  })
  const edges: Edge[] = [
    edge(id.start, id.greet),
    edge(id.greet, id.quote),
    edge(id.quote, id.check, QUOTE_QUOTED_HANDLE),
    edge(id.quote, id.endReview, QUOTE_ESCALATED_HANDLE),
    edge(id.check, id.askDetails, id.booking),
    edge(id.check, id.answer, CONDITION_ELSE_HANDLE),
    edge(id.askDetails, id.confirm),
    edge(id.confirm, id.endBooked),
    edge(id.answer, id.endAnswered),
  ]

  const label = service.trim() ? `${service.trim()[0].toUpperCase()}${service.trim().slice(1)}` : 'Photo'
  return { name: `${label} quote chatbot`, flow: { version: 1, nodes, edges } }
}
