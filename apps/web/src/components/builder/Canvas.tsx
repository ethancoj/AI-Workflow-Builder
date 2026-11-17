'use client'

import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback } from 'react'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { NODE_META, isWorkflowNodeType } from '@/lib/workflow/nodeMeta'
import type { WorkflowNode } from '@/lib/workflow/types'
import { nodeTypes } from './nodes'

export default function Canvas() {
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const onNodesChange = useBuilderStore((s) => s.onNodesChange)
  const onEdgesChange = useBuilderStore((s) => s.onEdgesChange)
  const onConnect = useBuilderStore((s) => s.onConnect)
  const addNode = useBuilderStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()

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
        alert('A workflow can only have one Start step. Use the one already on the canvas.')
      }
    },
    [screenToFlowPosition, addNode],
  )

  return (
    <div className="h-full w-full bg-page">
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
      </ReactFlow>
    </div>
  )
}
