'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup'

/** Where to go after logging in. Only same-site paths, so ?next= can't send people elsewhere. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/builder'
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Already logged in? Skip the form.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(nextPath())
    })
  }, [router])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace(nextPath())
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { business_name: businessName.trim() } },
        })
        if (error) throw error
        if (data.session) {
          router.replace(nextPath())
        } else {
          // Only happens if "Confirm email" is turned on in Supabase.
          setNotice('Account created. Check your email to confirm it, then log in.')
          setMode('login')
        }
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError(null)
    setNotice(null)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-900">
            {mode === 'login' ? 'Log in' : 'Create your merchant account'}
          </h1>
          <p className="text-sm text-slate-500">AI Workflow Builder for WhatsApp service businesses</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-600">Business name</span>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Ah Seng Aircon Services"
                required
                className={inputClass}
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className={inputClass}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-600">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={6}
              required
              className={inputClass}
            />
            {mode === 'signup' && <span className="block text-xs text-slate-400">At least 6 characters.</span>}
          </label>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {notice && <p className="text-sm text-emerald-600">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500">
          {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
          <button onClick={switchMode} className="font-medium text-blue-600 hover:underline">
            {mode === 'login' ? 'Create an account' : 'Log in'}
          </button>
        </p>
      </div>
    </main>
  )
}
