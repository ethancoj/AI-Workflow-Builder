import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Section } from '@/lib/dashboard/types'

/** White card with a heading, used by every Overview panel. */
export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  const headingId = `panel-${title.toLowerCase().replace(/\W+/g, '-')}`
  return (
    <section aria-labelledby={headingId} className={`rounded-[10px] border border-line bg-surface ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={headingId} className="text-sm font-semibold text-ink">
          {title}
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
  if (section.status === 'loading') {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading">
        <div className="h-4 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-line/60" />
      </div>
    )
  }
  if (section.status === 'error') {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-300">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Couldn’t load this. {section.message}</span>
      </p>
    )
  }
  if (isEmpty?.(section.data)) return <div className="text-sm text-muted">{empty}</div>
  return <>{children(section.data)}</>
}
