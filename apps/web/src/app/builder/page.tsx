'use client'

import Canvas from '@/components/builder/Canvas'
import SettingsPanel from '@/components/builder/SettingsPanel'
import Sidebar from '@/components/builder/Sidebar'
import { ReactFlowProvider } from '@xyflow/react'

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Canvas />
        </div>
        <SettingsPanel />
      </div>
    </ReactFlowProvider>
  )
}
