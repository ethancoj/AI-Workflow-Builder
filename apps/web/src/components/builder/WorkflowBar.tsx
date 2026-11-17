'use client'

import { useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import AccountMenu from '@/components/auth/AccountMenu'
import { NavButton, useShell } from '@/components/shell/AppShell'
import { useTestRunStore } from '@/lib/workflow/testRunStore'
import { ChecksButton } from './WorkflowChecks'
import { apiFetch } from '@/lib/api'
import { DEFAULT_WORKFLOW_NAME, useBuilderStore } from '@/lib/workflow/builderStore'
import { photoQuoteTemplate, type TemplateRubric } from '@/lib/workflow/templates'
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
  // A template link (?template=…) is used once; drop it so a refresh doesn't rebuild it.
  ;['template', 'rubric', 'rubricName', 'service'].forEach((k) => url.searchParams.delete(k))
  window.history.replaceState(null, '', url)
}

/** The merchant's most recently saved rubric, so a template can be ready to test straight away. */
async function latestRubric(): Promise<{ rubric: TemplateRubric; service?: string }> {
  try {
    const res = await apiFetch('/api/quotes/rubrics')
    if (!res.ok) return { rubric: null }
    const list = (await res.json()) as { id: string; name: string; service_type?: string; created_at?: string }[]
    const last = [...list].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]
    return last ? { rubric: { id: last.id, name: last.name }, service: last.service_type } : { rubric: null }
  } catch {
    return { rubric: null }
  }
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
      requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }))
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

    const params = new URLSearchParams(window.location.search)
    const idFromUrl = params.get('id')
    // From the Pricing Rubric page: "Create a chatbot from this rubric".
    if (!idFromUrl && params.get('template') === 'photo-quote') {
      const rubricId = params.get('rubric')
      const rubric = rubricId ? { id: rubricId, name: params.get('rubricName') ?? 'Your pricing rubric' } : null
      const { name, flow } = photoQuoteTemplate(rubric, params.get('service') ?? undefined)
      useBuilderStore.getState().loadTemplate(name, flow)
      setUrlWorkflowId(null)
      requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1 }))
    }
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
  }, [applyLoaded, fitView, showStatus])

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
    requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }))
    setStatus(null)
  }

  const startFromTemplate = async () => {
    if (!confirmDiscard()) return
    setBusy(true)
    const { rubric, service } = await latestRubric()
    const { name, flow } = photoQuoteTemplate(rubric, service)
    useBuilderStore.getState().loadTemplate(name, flow)
    setUrlWorkflowId(null)
    setBusy(false)
    requestAnimationFrame(() => fitView({ padding: 0.15, maxZoom: 1 }))
    showStatus({
      kind: 'ok',
      text: rubric ? `Template ready, using “${rubric.name}”. Try it in Test chat, then Save.` : 'Template ready. Pick a pricing rubric in the Photo Quote step.',
    })
  }

  const buttonClass =
    'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink hover:bg-brand-soft hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:hover:bg-surface disabled:hover:shadow-none'

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-ink">
      <NavButton />
      <input
        value={workflowName}
        onChange={(e) => setWorkflowName(e.target.value)}
        placeholder={DEFAULT_WORKFLOW_NAME}
        aria-label="Workflow name"
        className="w-56 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold text-ink hover:border-line hover:bg-brand-soft/60 focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      <span className={`flex items-center gap-1.5 text-xs ${dirty ? 'font-medium text-highlight-ink' : 'text-muted'}`}>
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />}
        {dirty ? 'Unsaved changes' : workflowId ? 'All changes saved' : 'Not saved yet'}
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
        <select
          value=""
          disabled={busy}
          onChange={(e) => {
            if (e.target.value === 'blank') startNew()
            else if (e.target.value === 'photo-quote') startFromTemplate()
          }}
          aria-label="Start a new workflow"
          className={buttonClass}
        >
          <option value="">New…</option>
          <option value="blank">Blank workflow</option>
          <option value="photo-quote">From template: Photo quote chatbot</option>
        </select>
        <button onClick={() => save(true)} disabled={busy} className={buttonClass} title="Save as a separate workflow">
          Save as copy
        </button>
        <button
          onClick={() => save(false)}
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-brand-on hover:bg-brand/80 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60"
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
