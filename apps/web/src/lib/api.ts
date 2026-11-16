import { supabase } from './supabase'

/**
 * fetch() against the FastAPI backend, with the logged-in merchant's token attached.
 * The backend identifies the merchant from this token (apps/api/merchant_auth.py).
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, { ...init, headers })
}

/** Pulls a readable message out of a FastAPI error response. */
export async function apiErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null)
  const detail = body?.detail
  if (typeof detail === 'string') return detail
  if (detail) return JSON.stringify(detail)
  return `${res.status} ${res.statusText}`
}
