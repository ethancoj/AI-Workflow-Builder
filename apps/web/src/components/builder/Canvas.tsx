'use client'

import { ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, Connection, useReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const initialNodes: { id: string; type: string; data: { label: string }; position: { x: number; y: number }; style: React.CSSProperties }[] = [
  {
    id: '1',
    type: 'input',
    data: { label: '▶ Start' },
    position: { x: 250, y: 50 },
    style: { backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', border: 'none' }
  },
]

const initialEdges: never[] = []

let nodeId = 2

export default function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds))
  }, [setEdges])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('application/reactflow')
    if (!type) return

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

const styleMap: Record<string, React.CSSProperties> = {
      start: { backgroundColor: '#16a34a', color: 'white', border: 'none' },
      llm: { backgroundColor: '#2563eb', color: 'white', border: 'none' },
      condition: { backgroundColor: '#d97706', color: 'white', border: 'none' },
      quote: { backgroundColor: '#7c3aed', color: 'white', border: 'none' },
      end: { backgroundColor: '#dc2626', color: 'white', border: 'none' },
    }

    const labelMap: Record<string, string> = {
      start: '▶ Start',
      llm: '🤖 LLM Response',
      condition: '🔀 Condition',
      quote: '📷 Quote',
      end: '⏹ End',
    }

    const newNode = {
      id: `${nodeId++}`,
      type: 'default',
      position,
      data: { label: labelMap[type] || type },
      style: styleMap[type] || {},
    }

    setNodes((nds) => nds.concat(newNode))
  }, [screenToFlowPosition, setNodes])

  const exportToJson = async () => {
  const flow = { nodes, edges }

  const { error } = await supabase
    .from('workflows')
    .insert({
      merchant_id: '00000000-0000-0000-0000-000000000000', // placeholder for now
      name: 'Test Workflow',
      flow_json: flow,
    })

  if (error) {
    console.error('Save failed:', error.message)
    alert('Save failed: ' + error.message)
  } else {
    alert('Workflow saved to Supabase!')
  }
}

  return (
    <div ref={reactFlowWrapper} style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />

      <div style={{
  position: 'absolute',
  top: '16px',
  right: '16px',
  zIndex: 10,
}}>
  <button
    onClick={exportToJson}
    style={{
      backgroundColor: '#2563eb',
      color: 'white',
      padding: '8px 16px',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: 'bold',
    }}
  >
    Export JSON
  </button>
</div>

      </ReactFlow>
    </div>
  )
}