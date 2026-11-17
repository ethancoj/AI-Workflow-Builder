'use client'

import { AlertCircle, Camera, CheckCircle2, Eye, EyeOff, Loader2, MessageSquareText, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'

type Mode = 'login' | 'signup'

/** Where to go after logging in. Only same-site paths, so ?next= can't send people elsewhere. */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
}

/** Supabase's messages are written for developers; say the same thing in plain words. */
function friendlyError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Check them and try again.'
  if (m.includes('already registered') || m.includes('already exists'))
    return 'There’s already an account with this email. Log in instead.'
  if (m.includes('password') && m.includes('6')) return 'Your password needs at least 6 characters.'
  if (m.includes('email') && m.includes('invalid')) return 'That email address doesn’t look right. Check it and try again.'
  if (m.includes('fetch') || m.includes('network')) return 'Couldn’t reach the server. Check your internet connection and try again.'
  return message
}

// What the product does, in the merchant's terms. No claims beyond what it actually does.
const POINTS = [
  { Icon: MessageSquareText, title: 'Answers customers on WhatsApp', text: 'Set it up with simple forms. No prompts, no code.' },
  { Icon: Camera, title: 'Prices jobs from a photo', text: 'Using the prices and conditions you set.' },
  { Icon: UserCheck, title: 'You stay in control', text: 'When the AI isn’t sure, the quote comes to you first.' },
]

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand/30'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [businessName, setBusinessName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      setError(friendlyError((err as Error).message))
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
    // Pinned to the light palette like the rest of the app.
    <main className="theme-light flex min-h-screen bg-page text-ink">
      {/* About the product: desktop only, so the form stays first on a phone */}
      <section
        aria-label="About AI Workflow Builder"
        className="hidden w-[44%] max-w-xl flex-col justify-between border-r border-line bg-surface p-10 lg:flex"
      >
        <p className="flex items-center gap-2.5 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-on" aria-hidden>
            AW
          </span>
          AI Workflow Builder
        </p>

        <div className="space-y-8">
          <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Your WhatsApp assistant, set up the way you run your shop.
          </h2>
          <ul className="divide-y divide-divider border-y border-divider">
            {POINTS.map(({ Icon, title, text }) => (
              <li key={title} className="flex gap-4 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line" aria-hidden>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="space-y-0.5">
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted">For Malaysian service businesses · Supported by Fylix</p>
      </section>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="animate-arrive w-full max-w-sm space-y-6">
          <p className="flex items-center gap-2.5 text-base font-semibold lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-on" aria-hidden>
              AW
            </span>
            AI Workflow Builder
          </p>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold">{mode === 'login' ? 'Log in' : 'Create your account'}</h1>
            <p className="text-sm text-muted">
              {mode === 'login'
                ? 'Welcome back. Log in to check your quotes and workflows.'
                : 'Create an account to start building your WhatsApp assistant.'}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1.5">
                <label htmlFor="business-name" className="text-xs font-medium">
                  Business name
                </label>
                <input
                  id="business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Ah Seng Aircon Services"
                  autoComplete="organization"
                  required
                  className={inputClass}
                />
                <p className="text-xs text-muted">Shown at the top of your dashboard. You can change it later.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium">
                Email
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@business.com"
                required
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  minLength={6}
                  required
                  aria-describedby={mode === 'signup' ? 'password-hint' : undefined}
                  className={`${inputClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-brand"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {mode === 'signup' && (
                <p id="password-hint" className="text-xs text-muted">
                  At least 6 characters.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="animate-arrive flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="animate-arrive flex items-start gap-2 rounded-lg border border-line px-3 py-2.5 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-on hover:bg-brand/80 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60 disabled:hover:bg-brand disabled:hover:shadow-none"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {busy ? (mode === 'login' ? 'Logging in…' : 'Creating your account…') : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>

          <p className="border-t border-divider pt-5 text-center text-sm text-muted">
            {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
            <button
              onClick={switchMode}
              className="rounded font-semibold text-ink underline decoration-line/30 underline-offset-4 hover:decoration-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              {mode === 'login' ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}
