'use client'

import { supabase } from '@/lib/supabase'
import { useSession } from './RequireAuth'

/** Shows who is logged in, with a log-out button. `beforeLogout` can cancel (e.g. unsaved work). */
export default function AccountMenu({
  beforeLogout,
  label,
}: {
  beforeLogout?: () => boolean
  /** Shown instead of the email, e.g. the merchant's business name. */
  label?: string
}) {
  const session = useSession()
  const email = label || session.user.email || 'Account'

  const logOut = async () => {
    if (beforeLogout && !beforeLogout()) return
    await supabase.auth.signOut()
    // Full page load (not client navigation) so nothing from this merchant,
    // like the canvas in the builder store, stays in memory for the next login.
    window.location.assign('/login')
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <span className="hidden max-w-40 truncate sm:inline" title={email}>
        {email}
      </span>
      <button
        onClick={logOut}
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        Log out
      </button>
    </div>
  )
}
