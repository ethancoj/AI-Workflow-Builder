'use client'

import Canvas from '@/components/builder/Canvas'
import Sidebar from '@/components/builder/Sidebar'
import { ReactFlowProvider } from '@xyflow/react'

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1 }}>
          <Canvas />
        </div>
      </div>
    </ReactFlowProvider>
  )
}