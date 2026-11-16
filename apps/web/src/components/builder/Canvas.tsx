'use client'

import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PLACEHOLDER_MERCHANT_ID } from '@/lib/merchant'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { NODE_META, isWorkflowNodeType } from '@/lib/workflow/nodeMeta'
import type { WorkflowJson, WorkflowNode } from '@/lib/workflow/types'
import { nodeTypes } from './nodes'

export default function Canvas() {
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const onNodesChange = useBuilderStore((s) => s.onNodesChange)
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange)
  const onConnect = useBuilderStore((s) => s.onConnect)
  const addNode = useBuilderStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()
  const [saving, setSaving] = useState(false)

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      const type = event.dataTransfer.getData('application/reactflow')
      if (!isWorkflowNodeType(type)) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (!addNode(type, position)) {
        alert('A workflow can only have one Start node.')
      }
    },
    [screenToFlowPosition, addNode],
  )

  const saveWorkflow = async () => {
    setSaving(true)
    const flow: WorkflowJson = { version: 1, nodes, edges }

    // TODO: still inserts a new row on every save; loading and updating saved workflows is next.
    const { error } = await supabase.from('workflows').insert({
      merchant_id: PLACEHOLDER_MERCHANT_ID,
      name: 'Test Workflow',
      flow_json: flow,
    })
    setSaving(false)

    if (error) {
      console.error('Save failed:', error.message)
      alert('Save failed: ' + error.message)
    } else {
      alert('Workflow saved to Supabase!')
    }
  }

  return (
    <div className="h-screen w-full">
      <ReactFlow<WorkflowNode>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap<WorkflowNode> nodeColor={(n) => NODE_META[n.type].color} />

        <div className="absolute right-4 top-4 z-10">
          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save workflow'}
          </button>
        </div>
      </ReactFlow>
    </div>
  )
}
