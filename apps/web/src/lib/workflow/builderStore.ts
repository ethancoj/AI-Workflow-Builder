import { create } from 'zustand'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { DEFAULT_END_MESSAGE } from './checks'
import { createNode } from './nodeMeta'
import type { WorkflowJson, WorkflowNode, WorkflowNodeType } from './types'

// Fixed id (not random) so the server and client render the same initial markup.
const initialNodes = (): WorkflowNode[] => [
  { id: 'start-1', type: 'start', position: { x: 250, y: 50 }, data: { trigger: 'any_message', keywords: [] } },
]

export const DEFAULT_WORKFLOW_NAME = 'Untitled workflow'

// Selection and size measurements change constantly but aren't edits worth saving.
const isEdit = (change: { type: string }) => change.type !== 'select' && change.type !== 'dimensions'

type BuilderState = {
  nodes: WorkflowNode[]
  edges: Edge[]
  /** Supabase id of the open workflow, or null if it has never been saved. */
  workflowId: string | null
  workflowName: string
  /** True when there are edits since the last load or save. */
  dirty: boolean

  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  /** Returns false if the node can't be added (only one Start node is allowed). */
  addNode: (type: WorkflowNodeType, position: XYPosition) => boolean
  updateNodeData: <T extends WorkflowNode>(id: string, patch: Partial<T['data']>) => void
  /** Removes a Condition branch along with the edge leaving its handle. */
  removeConditionBranch: (nodeId: string, branchId: string) => void
  setWorkflowName: (name: string) => void
  /** Selects one node (opens its settings), deselecting the rest. */
  selectNode: (id: string) => void
  /** Quick fix: adds an End step with a closing message and connects it to `sourceId`'s `handle`. */
  addConnectedEnd: (sourceId: string, handle: string | null) => void

  newWorkflow: () => void
  loadWorkflow: (id: string, name: string, flow: WorkflowJson) => void
  /** Puts a template on the canvas as a new, unsaved workflow. */
  loadTemplate: (name: string, flow: WorkflowJson) => void
  markSaved: (id: string, name: string) => void
  /** The canvas as saved JSON, without UI-only fields like selection or measured size. */
  toWorkflowJson: () => WorkflowJson
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  nodes: initialNodes(),
  edges: [],
  workflowId: null,
  workflowName: DEFAULT_WORKFLOW_NAME,
  dirty: false,

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes), dirty: get().dirty || changes.some(isEdit) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges), dirty: get().dirty || changes.some(isEdit) }),

  // Each output handle leads to exactly one next step, so the runtime never has to
  // choose between two edges. Connecting from a used handle replaces its old edge.
  onConnect: (connection) => {
    const sourceHandle = connection.sourceHandle ?? null
    const remaining = get().edges.filter(
      (e) => !(e.source === connection.source && (e.sourceHandle ?? null) === sourceHandle),
    )
    set({ edges: addEdge(connection, remaining), dirty: true })
  },

  addNode: (type, position) => {
    if (type === 'start' && get().nodes.some((n) => n.type === 'start')) return false
    set({ nodes: [...get().nodes, createNode(type, position)], dirty: true })
    return true
  },

  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as WorkflowNode) : n)),
      dirty: true,
    }),

  removeConditionBranch: (nodeId, branchId) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === 'condition'
          ? { ...n, data: { ...n.data, branches: n.data.branches.filter((b) => b.id !== branchId) } }
          : n,
      ),
      edges: get().edges.filter((e) => !(e.source === nodeId && e.sourceHandle === branchId)),
      dirty: true,
    }),

  setWorkflowName: (name) => set({ workflowName: name, dirty: true }),

  selectNode: (id) =>
    set({
      nodes: get().nodes.map((n) => (n.selected === (n.id === id) ? n : { ...n, selected: n.id === id })),
      edges: get().edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
    }),

  addConnectedEnd: (sourceId, handle) => {
    const source = get().nodes.find((n) => n.id === sourceId)
    if (!source) return
    // Place it to the right of the source, staggered so several fixes don't stack exactly.
    const siblings = get().edges.filter((e) => e.source === sourceId).length
    const end = createNode('end', { x: source.position.x + 320, y: source.position.y + siblings * 110 })
    if (end.type === 'end') end.data.message = DEFAULT_END_MESSAGE
    set({ nodes: [...get().nodes, end] })
    get().onConnect({ source: sourceId, sourceHandle: handle, target: end.id, targetHandle: null })
  },

  newWorkflow: () =>
    set({ nodes: initialNodes(), edges: [], workflowId: null, workflowName: DEFAULT_WORKFLOW_NAME, dirty: false }),

  loadWorkflow: (id, name, flow) =>
    set({
      nodes: flow.nodes.map((n) => ({ ...n, selected: false })),
      edges: flow.edges.map((e) => ({ ...e, selected: false })),
      workflowId: id,
      workflowName: name,
      dirty: false,
    }),

  loadTemplate: (name, flow) =>
    set({
      nodes: flow.nodes.map((n) => ({ ...n, selected: false })),
      edges: flow.edges.map((e) => ({ ...e, selected: false })),
      workflowId: null,
      workflowName: name,
      dirty: true,
    }),

  markSaved: (id, name) => set({ workflowId: id, workflowName: name, dirty: false }),

  toWorkflowJson: () => ({
    version: 1,
    nodes: get().nodes.map(({ id, type, position, data }) => ({ id, type, position, data }) as WorkflowNode),
    edges: get().edges.map(({ id, source, target, sourceHandle, targetHandle }) => ({
      id,
      source,
      target,
      sourceHandle: sourceHandle ?? null,
      targetHandle: targetHandle ?? null,
    })),
  }),
}))
