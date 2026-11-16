'use client'

import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AccountMenu from '@/components/auth/AccountMenu'
import { NavButton, useShell } from '@/components/shell/AppShell'
import { useTestRunStore } from '@/lib/workflow/testRunStore'
import { ChecksButton } from './WorkflowChecks'
import { DEFAULT_WORKFLOW_NAME, useBuilderStore } from '@/lib/workflow/builderStore'
import {
  createWorkflow,
  getWorkflow,
  listWorkflows,
  updateWorkflow,
  type LoadedWorkflow,
  type WorkflowSummary,
} from '@/lib/workflow/workflowsApi'

type Status = { kind: 'ok' | 'error'; text: string } | null

/** Keeps ?id= in the address bar in sync so a refresh reopens the same workflow. */
function setUrlWorkflowId(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('id', id)
  else url.searchParams.delete('id')
  window.history.replaceState(null, '', url)
}

const confirmDiscard = () =>
  !useBuilderStore.getState().dirty || window.confirm('You have unsaved changes. Discard them?')

export default function WorkflowBar() {
  const workflowId = useBuilderStore((s) => s.workflowId)
  const workflowName = useBuilderStore((s) => s.workflowName)
  const dirty = useBuilderStore((s) => s.dirty)
  const setWorkflowName = useBuilderStore((s) => s.setWorkflowName)
  const { fitView } = useReactFlow()
  const { merchantName } = useShell()
  const testing = useTestRunStore((s) => s.open)
  const setTesting = useTestRunStore((s) => s.setOpen)

  const [workflows, setWorkflows] = useState<WorkflowSummary[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showStatus = useCallback((next: Status) => {
    setStatus(next)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    // Success messages fade out; errors stay until the next action.
    if (next?.kind === 'ok') statusTimer.current = setTimeout(() => setStatus(null), 3000)
  }, [])

  const refreshList = useCallback(async () => {
    try {
      setWorkflows(await listWorkflows())
    } catch (e) {
      showStatus({ kind: 'error', text: `Couldn't load your workflows: ${(e as Error).message}` })
    }
  }, [showStatus])

  /** Puts a fetched workflow on the canvas. Touches no React state, so effects can call it. */
  const applyLoaded = useCallback(
    (wf: LoadedWorkflow) => {
      useBuilderStore.getState().loadWorkflow(wf.id, wf.name, wf.flow)
      setUrlWorkflowId(wf.id)
      // Wait a frame so React Flow has rendered the new nodes before fitting.
      requestAnimationFrame(() => fitView({ padding: 0.2 }))
    },
    [fitView],
  )

  const openWorkflow = async (id: string) => {
    setBusy(true)
    try {
      applyLoaded(await getWorkflow(id))
      setStatus(null)
    } catch (e) {
      showStatus({ kind: 'error', text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  // On first load: fill the menu, and reopen the workflow named in the URL (if any).
  // State is only set in the async callbacks, and skipped if the bar unmounted meanwhile.
  useEffect(() => {
    let cancelled = false
    listWorkflows()
      .then((list) => !cancelled && setWorkflows(list))
      .catch((e: Error) => !cancelled && showStatus({ kind: 'error', text: `Couldn't load your workflows: ${e.message}` }))

    const idFromUrl = new URLSearchParams(window.location.search).get('id')
    if (idFromUrl) {
      getWorkflow(idFromUrl)
        .then((wf) => !cancelled && applyLoaded(wf))
        .catch((e: Error) => {
          if (cancelled) return
          setUrlWorkflowId(null) // drop the bad id so a refresh doesn't hit the same error
          showStatus({ kind: 'error', text: e.message })
        })
    }
    return () => {
      cancelled = true
    }
  }, [applyLoaded, showStatus])

  // Ask before closing or refreshing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const save = async (asCopy: boolean) => {
    const { toWorkflowJson, markSaved } = useBuilderStore.getState()
    const name = workflowName.trim() || DEFAULT_WORKFLOW_NAME
    const finalName = asCopy ? `${name} (copy)` : name
    setBusy(true)
    try {
      const flow = toWorkflowJson()
      let id = workflowId
      if (id && !asCopy) {
        await updateWorkflow(id, finalName, flow)
      } else {
        id = await createWorkflow(finalName, flow)
      }
      markSaved(id, finalName)
      setUrlWorkflowId(id)
      showStatus({ kind: 'ok', text: asCopy ? 'Saved as a new copy' : 'Saved' })
      refreshList()
    } catch (e) {
      showStatus({ kind: 'error', text: `Save failed: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const startNew = () => {
    if (!confirmDiscard()) return
    useBuilderStore.getState().newWorkflow()
    setUrlWorkflowId(null)
    requestAnimationFrame(() => fitView({ padding: 0.2 }))
    setStatus(null)
  }

  const buttonClass =
    'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-page focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-ink">
      <NavButton />
      <input
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        placeholder={DEFAULT_WORKFLOW_NAME}
        aria-label="Workflow name"
        className="w-56 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold text-ink hover:border-line focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <span className={`text-xs ${dirty ? 'font-medium text-highlight-ink' : 'text-muted'}`}>
        {dirty ? '● Unsaved changes' : workflowId ? 'All changes saved' : 'Not saved yet'}
      </span>

      <div className="ml-auto flex items-center gap-2">
        {status && (
          <span className={`max-w-xs truncate text-xs ${status.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`} title={status.text}>
            {status.text}
          </span>
        )}
        <select
          value=""
          disabled={busy || !workflows}
          onChange={(e) => {
            const id = e.target.value
            if (id && id !== workflowId && confirmDiscard()) openWorkflow(id)
          }}
          aria-label="Open a saved workflow"
          className={buttonClass}
        >
          <option value="">{workflows ? `Open… (${workflows.length})` : 'Loading…'}</option>
          {workflows?.map((w) => (
            <option key={w.id} value={w.id} disabled={w.version !== 1}>
              {w.name} · {new Date(w.created_at).toLocaleDateString()}
              {w.version !== 1 ? ' (old format)' : w.id === workflowId ? ' (open)' : ''}
            </option>
          ))}
        </select>
        <ChecksButton />
        <button
          onClick={() => setTesting(!testing)}
          aria-pressed={testing}
          title="Chat with this workflow as a customer"
          className={testing ? `${buttonClass} !bg-brand-soft ring-1 ring-brand` : buttonClass}
        >
          {testing ? 'Close test chat' : 'Test chat'}
        </button>
        <button onClick={startNew} disabled={busy} className={buttonClass}>
          New
        </button>
        <button onClick={() => save(true)} disabled={busy} className={buttonClass} title="Save as a separate workflow">
          Save as copy
        </button>
        <button
          onClick={() => save(false)}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {busy ? 'Working…' : 'Save'}
        </button>
        <div className="ml-2 border-l border-line pl-3">
          <AccountMenu beforeLogout={confirmDiscard} label={merchantName} />
        </div>
      </div>
    </div>
  )
}
