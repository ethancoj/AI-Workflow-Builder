'use client'

import { ReactFlowProvider } from '@xyflow/react'
import RequireAuth from '@/components/auth/RequireAuth'
import Canvas from '@/components/builder/Canvas'
import SettingsPanel from '@/components/builder/SettingsPanel'
import TestChat from '@/components/builder/TestChat'
import { IssuesProvider } from '@/components/builder/WorkflowChecks'
import Sidebar from '@/components/builder/Sidebar'
import WorkflowBar from '@/components/builder/WorkflowBar'
import AppShell from '@/components/shell/AppShell'
import { useTestRunStore } from '@/lib/workflow/testRunStore'

/** Right-hand panel: the selected step's settings, or the test chat when it's open. */
function RightPanel() {
  const testing = useTestRunStore((s) => s.open)
  return testing ? <TestChat /> : <SettingsPanel />
}

export default function BuilderPage() {
  return (
    <RequireAuth>
      {/* Compact nav rail so the canvas keeps most of the width. */}
      <AppShell active="/builder" compact>
        <ReactFlowProvider>
          <IssuesProvider>
          <div className="flex h-screen flex-col">
            <WorkflowBar />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <div className="min-w-0 flex-1">
                <Canvas />
              </div>
              <RightPanel />
            </div>
          </div>
          </IssuesProvider>
        </ReactFlowProvider>
      </AppShell>
    </RequireAuth>
  )
}
