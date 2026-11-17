'use client'

import { ReactFlow, Background, Controls, MiniMap, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback } from 'react'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { isWorkflowNodeType } from '@/lib/workflow/nodeMeta'
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
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        defaultEdgeOptions={{ style: { stroke: '#52525b', strokeWidth: 1.5 } }}
        connectionLineStyle={{ stroke: '#0a0a0a', strokeWidth: 1.5, strokeDasharray: '4 3' }}
      >
        <Background color="#d4d4d8" gap={20} />
        <Controls />
        <MiniMap<WorkflowNode>
          nodeColor="#f4f4f5"
          nodeStrokeColor="#18181b"
          nodeStrokeWidth={2}
          nodeBorderRadius={6}
          maskColor="rgb(244 244 245 / 0.7)"
          pannable
          zoomable
          ariaLabel="Overview map of the workflow"
        />
      </ReactFlow>
    </div>
  )
}
