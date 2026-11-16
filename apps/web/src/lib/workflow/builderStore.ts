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
import { createNode } from './nodeMeta'
import type { WorkflowNode, WorkflowNodeType } from './types'

// Fixed id (not random) so the server and client render the same initial markup.
const initialNodes: WorkflowNode[] = [
  { id: 'start-1', type: 'start', position: { x: 250, y: 50 }, data: { trigger: 'any_message', keywords: [] } },
]

type BuilderState = {
  nodes: WorkflowNode[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  /** Returns false if the node can't be added (only one Start node is allowed). */
  addNode: (type: WorkflowNodeType, position: XYPosition) => boolean
  updateNodeData: <T extends WorkflowNode>(id: string, patch: Partial<T['data']>) => void
  /** Removes a Condition branch along with the edge leaving its handle. */
  removeConditionBranch: (nodeId: string, branchId: string) => void
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  nodes: initialNodes,
  edges: [],

  onNodesChange: (changes) => set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),

  // Each output handle leads to exactly one next step, so the runtime never has to
  // choose between two edges. Connecting from a used handle replaces its old edge.
  onConnect: (connection) => {
    const sourceHandle = connection.sourceHandle ?? null
    const remaining = get().edges.filter(
      (e) => !(e.source === connection.source && (e.sourceHandle ?? null) === sourceHandle),
    )
    set({ edges: addEdge(connection, remaining) })
  },

  addNode: (type, position) => {
    if (type === 'start' && get().nodes.some((n) => n.type === 'start')) return false
    set({ nodes: [...get().nodes, createNode(type, position)] })
    return true
  },

  updateNodeData: (id, patch) =>
    set({
      nodes: get().nodes.map((n) => (n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as WorkflowNode) : n)),
    }),

  removeConditionBranch: (nodeId, branchId) =>
    set({
      nodes: get().nodes.map((n) =>
        n.id === nodeId && n.type === 'condition'
          ? { ...n, data: { ...n.data, branches: n.data.branches.filter((b) => b.id !== branchId) } }
          : n,
      ),
      edges: get().edges.filter((e) => !(e.source === nodeId && e.sourceHandle === branchId)),
    }),
}))
