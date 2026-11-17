import type { Edge } from '@xyflow/react'
import { NODE_META, intentLabel } from './nodeMeta'
import {
  CONDITION_ELSE_HANDLE,
  QUOTE_ESCALATED_HANDLE,
  QUOTE_QUOTED_HANDLE,
  type WorkflowNode,
} from './types'

// Workflow checks: plain-language problems a non-technical merchant can understand and fix.
//   error   = the bot would break (blocks deploy once deploying exists)
//   warning = the bot runs, but some customers would get a poor or no-answer experience
// The runtime's safety-net reply covers gaps at run time; these checks help merchants
// close the gaps before customers ever hit them.

export type IssueFix =
  | { kind: 'addEnd'; nodeId: string; handle: string | null; label: string } // connect a replying End step
  | { kind: 'setEndMessage'; nodeId: string; label: string }

export type Issue = {
  id: string
  severity: 'error' | 'warning'
  nodeId?: string
  title: string
  detail: string
  fix?: IssueFix
}

export const DEFAULT_END_MESSAGE = 'Thanks for your message! Someone from our team will get back to you shortly.'


export function checkWorkflow(nodes: WorkflowNode[], edges: Edge[]): Issue[] {
  const issues: Issue[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out = (id: string, handle: string | null = null) =>
    edges.find((e) => e.source === id && (e.sourceHandle ?? null) === handle && byId.has(e.target))
  const incoming = (id: string) => edges.filter((e) => e.target === id && byId.has(e.source))

  const start = nodes.find((n) => n.type === 'start')
  if (!start) {
    issues.push({
      id: 'no-start',
      severity: 'error',
      title: 'Add a Start step',
      detail: 'Every workflow begins with a Start step. Drag one onto the canvas.',
    })
  }

  // Which steps can actually run (reachable from Start).
  const reachable = new Set<string>()
  if (start) {
    const queue = [start.id]
    while (queue.length) {
      const id = queue.pop()!
      if (reachable.has(id)) continue
      reachable.add(id)
      edges.filter((e) => e.source === id && byId.has(e.target)).forEach((e) => queue.push(e.target))
    }
  }

  for (const n of nodes) {
    const name = NODE_META[n.type].label

    if (n.type !== 'start' && start && !reachable.has(n.id)) {
      issues.push({
        id: `unreachable-${n.id}`,
        severity: 'warning',
        nodeId: n.id,
        title: `This ${name} step never runs`,
        detail: 'Nothing leads to it from Start. Connect it into the flow, or delete it.',
      })
    }

    switch (n.type) {
      case 'start':
        if (n.data.trigger === 'keyword' && n.data.keywords.length === 0) {
          issues.push({
            id: `start-keywords-${n.id}`,
            severity: 'error',
            nodeId: n.id,
            title: 'Start needs at least one keyword',
            detail: 'It only starts when a message has one of your keywords, but none are set. Add keywords, or choose “any message”.',
          })
        }
        if (!out(n.id)) {
          issues.push({
            id: `start-next-${n.id}`,
            severity: 'error',
            nodeId: n.id,
            title: 'Start isn’t connected to anything',
            detail: 'Customers who message you would only get the safety-net reply. Connect Start to your first step.',
          })
        }
        break

      case 'llm':
        if (!n.data.persona.trim() && !n.data.instructions.trim()) {
          issues.push({
            id: `llm-empty-${n.id}`,
            severity: 'warning',
            nodeId: n.id,
            title: `Tell this ${NODE_META.llm.label} step what to do`,
            detail: 'Without knowing who is replying or what to do, it can only send a general reply.',
          })
        }
        break

      case 'condition': {
        if (n.data.branches.length === 0) {
          issues.push({
            id: `cond-nobranches-${n.id}`,
            severity: 'warning',
            nodeId: n.id,
            title: `This ${NODE_META.condition.label} step has no paths`,
            detail: 'Every message goes down “Otherwise”. Add a path for what customers usually ask.',
          })
        }
        n.data.branches.forEach((b, i) => {
          const label = b.value.trim()
          ? `“${b.match === 'intent' ? intentLabel(b.value) : b.value.trim()}”`
          : `Path ${i + 1}`
          if (!b.value.trim()) {
            issues.push({
              id: `cond-emptybranch-${b.id}`,
              severity: 'warning',
              nodeId: n.id,
              title: `${label} is empty`,
              detail: 'An empty path never matches. Fill it in or remove it.',
            })
          } else if (!out(n.id, b.id)) {
            issues.push({
              id: `cond-branch-next-${b.id}`,
              severity: 'warning',
              nodeId: n.id,
              title: `Path ${label} isn’t connected`,
              detail: 'Customers who match it would only get the safety-net reply.',
              fix: { kind: 'addEnd', nodeId: n.id, handle: b.id, label: 'Add a reply step' },
            })
          }
        })
        if (!out(n.id, CONDITION_ELSE_HANDLE)) {
          issues.push({
            id: `cond-else-${n.id}`,
            severity: 'warning',
            nodeId: n.id,
            title: '“Otherwise” isn’t connected',
            detail: 'Customers whose message matches no branch would only get the safety-net reply.',
            fix: { kind: 'addEnd', nodeId: n.id, handle: CONDITION_ELSE_HANDLE, label: 'Add a reply step' },
          })
        }
        break
      }

      case 'quote':
        if (!n.data.rubricId) {
          issues.push({
            id: `quote-rubric-${n.id}`,
            severity: 'error',
            nodeId: n.id,
            title: `Choose a pricing rubric for this ${NODE_META.quote.label} step`,
            detail: 'The AI needs your pricing rubric to price a photo. Pick one in the step’s settings.',
          })
        }
        for (const [handle, label] of [
          [QUOTE_QUOTED_HANDLE, 'Quoted'],
          [QUOTE_ESCALATED_HANDLE, 'Needs human review'],
        ] as const) {
          if (!out(n.id, handle)) {
            issues.push({
              id: `quote-${handle}-${n.id}`,
              severity: 'warning',
              nodeId: n.id,
              title: `The “${label}” exit isn’t connected`,
              detail: 'The conversation would stop there. Connect it to a next step, e.g. an End step with a message.',
              fix: { kind: 'addEnd', nodeId: n.id, handle, label: 'Add an End step' },
            })
          }
        }
        break

      case 'end': {
        // An empty End is fine right after a step that replied (LLM, Quote). After a Start or a
        // Condition nothing has been said yet, so the customer would get no proper answer.
        const silentBefore = incoming(n.id).some((e) => {
          const t = byId.get(e.source)?.type
          return t === 'condition' || t === 'start'
        })
        if (!n.data.message.trim() && silentBefore) {
          issues.push({
            id: `end-silent-${n.id}`,
            severity: 'warning',
            nodeId: n.id,
            title: 'This End step says nothing',
            detail: 'Customers who reach it haven’t had a reply yet, so they would only get the safety-net message.',
            fix: { kind: 'setEndMessage', nodeId: n.id, label: 'Add a closing message' },
          })
        }
        break
      }
    }
  }

  // Loops made only of Start/Condition steps never wait for the customer, so they'd spin forever.
  const passThrough = new Set(nodes.filter((n) => n.type === 'condition' || n.type === 'start').map((n) => n.id))
  const visiting = new Set<string>()
  const done = new Set<string>()
  let loopAt: string | null = null
  const visit = (id: string) => {
    if (loopAt || done.has(id)) return
    if (visiting.has(id)) {
      loopAt = id
      return
    }
    visiting.add(id)
    edges.filter((e) => e.source === id && passThrough.has(e.target)).forEach((e) => visit(e.target))
    visiting.delete(id)
    done.add(id)
  }
  passThrough.forEach(visit)
  if (loopAt) {
    issues.push({
      id: 'loop',
      severity: 'error',
      nodeId: loopAt,
      title: `${NODE_META.condition.label} steps loop back on each other`,
      detail: 'These steps would go round in circles without ever replying. Add a reply step inside the loop, or remove a connection.',
    })
  }

  // Problems first, then warnings.
  return issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1))
}
