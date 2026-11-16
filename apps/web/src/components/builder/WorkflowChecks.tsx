'use client'

import { useReactFlow } from '@xyflow/react'
import { AlertTriangle, CheckCircle2, OctagonAlert } from 'lucide-react'
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useBuilderStore } from '@/lib/workflow/builderStore'
import { checkWorkflow, DEFAULT_END_MESSAGE, type Issue, type IssueFix } from '@/lib/workflow/checks'
import { useTestRunStore } from '@/lib/workflow/testRunStore'

const IssuesContext = createContext<Issue[]>([])

/** Runs the workflow checks whenever the canvas changes and shares the result. */
export function IssuesProvider({ children }: { children: ReactNode }) {
  const nodes = useBuilderStore((s) => s.nodes)
  const edges = useBuilderStore((s) => s.edges)
  const issues = useMemo(() => checkWorkflow(nodes, edges), [nodes, edges])
  return <IssuesContext.Provider value={issues}>{children}</IssuesContext.Provider>
}

export const useIssues = () => useContext(IssuesContext)

/** Severity badge shown on a step card that has issues. */
export function NodeIssueBadge({ nodeId }: { nodeId: string }) {
  const mine = useIssues().filter((i) => i.nodeId === nodeId)
  if (mine.length === 0) return null
  const error = mine.some((i) => i.severity === 'error')
  return (
    <span
      title={mine.map((i) => i.title).join('\n')}
      className={`absolute -left-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white shadow ${
        error ? 'bg-rose-600' : 'bg-amber-500'
      }`}
    >
      {mine.length}
      <span className="sr-only"> {error ? 'problems' : 'warnings'} on this step</span>
    </span>
  )
}

function useApplyFix() {
  const updateNodeData = useBuilderStore((s) => s.updateNodeData)
  const addConnectedEnd = useBuilderStore((s) => s.addConnectedEnd)
  return (fix: IssueFix) => {
    if (fix.kind === 'addEnd') addConnectedEnd(fix.nodeId, fix.handle)
    else updateNodeData(fix.nodeId, { message: DEFAULT_END_MESSAGE })
  }
}

/** "Show step": select it, open its settings, and bring it into view. */
function useShowStep() {
  const selectNode = useBuilderStore((s) => s.selectNode)
  const closeTestChat = useTestRunStore((s) => s.setOpen)
  const { fitView } = useReactFlow()
  return (id: string) => {
    closeTestChat(false)
    selectNode(id)
    requestAnimationFrame(() => fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.4 }))
  }
}

/** Status button for the workflow bar, with a dropdown listing every issue and its fix. */
export function ChecksButton() {
  const issues = useIssues()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const applyFix = useApplyFix()
  const showStep = useShowStep()

  const errors = issues.filter((i) => i.severity === 'error').length
  const warnings = issues.length - errors

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const summary =
    issues.length === 0
      ? 'No problems found'
      : [errors && `${errors} problem${errors === 1 ? '' : 's'}`, warnings && `${warnings} warning${warnings === 1 ? '' : 's'}`]
          .filter(Boolean)
          .join(' · ')

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-brand ${
          errors ? 'border-rose-300 bg-rose-50 text-rose-800' : warnings ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-line text-ink'
        }`}
      >
        {errors ? (
          <OctagonAlert className="h-4 w-4" aria-hidden />
        ) : warnings ? (
          <AlertTriangle className="h-4 w-4" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        )}
        {summary}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Workflow checks"
          className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(26rem,90vw)] overflow-y-auto rounded-[10px] border border-line bg-surface text-sm text-ink shadow-xl"
        >
          <header className="border-b border-divider px-4 py-3">
            <h2 className="font-semibold">Workflow checks</h2>
            <p className="text-xs text-muted">
              {issues.length === 0
                ? 'Every path gives the customer a reply. Try it in the test chat.'
                : 'Problems stop the bot working. Warnings mean some customers would only get the safety-net reply.'}
            </p>
          </header>
          {issues.length > 0 && (
            <ul className="divide-y divide-divider">
              {issues.map((issue) => (
                <li key={issue.id} className="flex gap-3 px-4 py-3">
                  {issue.severity === 'error' ? (
                    <OctagonAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-label="Problem" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-label="Warning" />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-medium">{issue.title}</p>
                    <p className="text-xs text-muted">{issue.detail}</p>
                    <div className="flex flex-wrap gap-2">
                      {issue.fix && (
                        <button
                          onClick={() => applyFix(issue.fix!)}
                          className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-on hover:bg-brand/85 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
                        >
                          {issue.fix.label}
                        </button>
                      )}
                      {issue.nodeId && (
                        <button
                          onClick={() => {
                            showStep(issue.nodeId!)
                            setOpen(false)
                          }}
                          className="rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          Show step
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
