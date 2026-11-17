import { AlertCircle, RotateCcw } from 'lucide-react'
import { createContext, useContext, type ReactNode } from 'react'
import type { Section } from '@/lib/dashboard/types'

/** Reloads the page's data; provided by the Overview so every failed panel can offer “Try again”. */
export const RetryContext = createContext<(() => void) | null>(null)

/** White card with a heading, used by every Overview panel. */
export function Panel({
  title,
  count,
  id,
  action,
  children,
  className = '',
}: {
  title: string
  /** Shown as a small chip after the title, e.g. how many items are waiting. */
  count?: number
  /** Anchor id, so other parts of the page can link/jump to this panel. */
  id?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-labelledby={headingId}
      className={`scroll-mt-4 rounded-[10px] border border-line bg-surface outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-divider px-4 py-3">
        <h2 id={headingId} className="flex items-center gap-2 text-base font-semibold tracking-tight text-ink">
          {title}
          {count !== undefined && (
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-on">
              {count}
              <span className="sr-only"> waiting for you</span>
            </span>
          )}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Renders loading / error / empty states for a Section, and `children(data)` once it's ready. */
export function SectionBody<T>({
  section,
  isEmpty,
  empty,
  children,
}: {
  section: Section<T>
  isEmpty?: (data: T) => boolean
  empty: ReactNode
  children: (data: T) => ReactNode
}) {
  const retry = useContext(RetryContext)
  if (section.status === 'loading') {
    return (
      <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading">
        <div className="h-4 w-3/4 animate-pulse rounded bg-brand-soft" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-brand-soft" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-brand-soft" />
      </div>
    )
  }
  if (section.status === 'error') {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-x-3 gap-y-2 text-sm text-rose-700">
        <p className="flex min-w-0 flex-1 items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Couldn’t load this. {section.message}</span>
        </p>
        {retry && (
          <button
            onClick={retry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-brand-soft focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        )}
      </div>
    )
  }
  if (isEmpty?.(section.data)) return <div className="text-sm text-muted">{empty}</div>
  return <>{children(section.data)}</>
}
