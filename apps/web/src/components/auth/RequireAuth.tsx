'use client'

import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

const SessionContext = createContext<Session | null>(null)

/** The logged-in session. Only usable inside <RequireAuth>. */
export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used inside <RequireAuth>')
  return session
}

/**
 * Renders children only for a logged-in merchant; otherwise sends them to /login
 * and brings them back afterwards. This is a convenience for the UI. The real
 * protection is RLS in the database and the token check in the API.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  // undefined = still checking, null = logged out
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === null) {
      const next = window.location.pathname + window.location.search
      // Full page load so in-memory state (e.g. the builder canvas) is wiped on logout/expiry.
      window.location.replace(`/login?next=${encodeURIComponent(next)}`)
    }
  }, [session])

  if (!session) {
    return <div className="flex h-screen items-center justify-center text-sm text-slate-500">Loading…</div>
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
