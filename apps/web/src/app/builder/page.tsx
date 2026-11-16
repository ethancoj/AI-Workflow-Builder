'use client'

import { ReactFlowProvider } from '@xyflow/react'
import RequireAuth from '@/components/auth/RequireAuth'
import Canvas from '@/components/builder/Canvas'
import SettingsPanel from '@/components/builder/SettingsPanel'
import Sidebar from '@/components/builder/Sidebar'
import WorkflowBar from '@/components/builder/WorkflowBar'
import AppShell from '@/components/shell/AppShell'

export default function BuilderPage() {
  return (
    <RequireAuth>
      {/* Compact nav rail so the canvas keeps most of the width. */}
      <AppShell active="/builder" compact>
        <ReactFlowProvider>
          <div className="flex h-screen flex-col">
            <WorkflowBar />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <div className="min-w-0 flex-1">
                <Canvas />
              </div>
              <SettingsPanel />
            </div>
          </div>
        </ReactFlowProvider>
      </AppShell>
    </RequireAuth>
  )
}
