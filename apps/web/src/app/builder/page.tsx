'use client'

import RequireAuth from '@/components/auth/RequireAuth'
import Canvas from '@/components/builder/Canvas'
import SettingsPanel from '@/components/builder/SettingsPanel'
import Sidebar from '@/components/builder/Sidebar'
import WorkflowBar from '@/components/builder/WorkflowBar'
import { ReactFlowProvider } from '@xyflow/react'

export default function BuilderPage() {
  return (
    <RequireAuth>
      <ReactFlowProvider>
        <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
          <Sidebar />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <WorkflowBar />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Canvas />
            </div>
          </div>
          <SettingsPanel />
        </div>
      </ReactFlowProvider>
    </RequireAuth>
  )
}
