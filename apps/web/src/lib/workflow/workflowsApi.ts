import { supabase } from '@/lib/supabase'
import { PLACEHOLDER_MERCHANT_ID } from '@/lib/merchant'
import type { WorkflowJson } from './types'

// All reads/writes of the `workflows` table go through here. They run in the browser
// with the anon key, so scoping by merchant is only a filter until auth + RLS exist.

export type WorkflowSummary = {
  id: string
  name: string
  created_at: string
  /** null for rows saved before the versioned format; those can't be opened. */
  version: number | null
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('id, name, created_at, version:flow_json->version')
    .eq('merchant_id', PLACEHOLDER_MERCHANT_ID)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WorkflowSummary[]
}

export type LoadedWorkflow = { id: string; name: string; flow: WorkflowJson }

/** Throws a readable error if the row is missing or in the old, unversioned format. */
export async function getWorkflow(id: string): Promise<LoadedWorkflow> {
  const { data, error } = await supabase
    .from('workflows')
    .select('id, name, flow_json')
    .eq('id', id)
    .eq('merchant_id', PLACEHOLDER_MERCHANT_ID)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('That workflow no longer exists.')
  const flow = data.flow_json as Partial<WorkflowJson> | null
  if (flow?.version !== 1 || !Array.isArray(flow.nodes) || !Array.isArray(flow.edges)) {
    throw new Error('This workflow was saved in an older format and can’t be opened.')
  }
  return { id: data.id, name: data.name ?? 'Untitled workflow', flow: flow as WorkflowJson }
}

export async function createWorkflow(name: string, flow: WorkflowJson): Promise<string> {
  const { data, error } = await supabase
    .from('workflows')
    .insert({ merchant_id: PLACEHOLDER_MERCHANT_ID, name, flow_json: flow })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id
}

export async function updateWorkflow(id: string, name: string, flow: WorkflowJson): Promise<void> {
  const { data, error } = await supabase
    .from('workflows')
    .update({ name, flow_json: flow })
    .eq('id', id)
    .eq('merchant_id', PLACEHOLDER_MERCHANT_ID)
    .select('id')
  if (error) throw new Error(error.message)
  // An update that matches no rows is not an error in Supabase, so check explicitly.
  if (!data?.length) throw new Error('That workflow no longer exists. Use “Save as copy” to keep your work.')
}
