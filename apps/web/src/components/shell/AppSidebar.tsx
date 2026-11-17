'use client'

import {
  Calculator,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

type NavItem = {
  label: string
  Icon: LucideIcon
  href?: string // missing = not built yet
  unavailableReason?: string
}

export const NAV: NavItem[] = [
  { label: 'Overview', Icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Workflows', Icon: Workflow, href: '/builder' },
  { label: 'Quote Requests', Icon: Inbox, unavailableReason: 'A full quote inbox is coming soon. Recent quotes are on the Overview.' },
  { label: 'Conversations', Icon: MessagesSquare, unavailableReason: 'Available once WhatsApp is connected.' },
  { label: 'Pricing Rubric', Icon: Calculator, href: '/quotes' },
  { label: 'Settings', Icon: Settings, unavailableReason: 'Settings are coming soon.' },
]

/**
 * The navigation column. `compact` is an icon-only rail (used by the builder,
 * which needs the width for its canvas); labels stay available as tooltips and to screen readers.
 */
function SidebarContents({ active, compact = false, onNavigate }: { active: string; compact?: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col border-r border-line bg-sidebar text-sidebar-ink">
      <div className={compact ? 'flex justify-center py-5' : 'px-5 py-5'}>
        {compact ? (
          <span
            title="AI Workflow Builder"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-on"
          >
            AW
            <span className="sr-only">AI Workflow Builder</span>
          </span>
        ) : (
          <p className="text-base font-semibold text-sidebar-ink">AI Workflow Builder</p>
        )}
      </div>

      <nav aria-label="Main" className={`flex-1 ${compact ? 'px-2' : 'px-3'}`}>
        <ul className="space-y-1">
          {NAV.filter((n) => n.href).map(({ label, Icon, href }) => {
            const isActive = href === active
            return (
              <li key={label}>
                <Link
                  href={href!}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  title={compact ? label : undefined}
                  className={`flex w-full items-center rounded-lg py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    compact ? 'justify-center px-0' : 'gap-3 px-3'
                  } ${isActive ? 'bg-brand font-medium text-brand-on' : 'text-sidebar-ink hover:bg-sidebar-hover'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {compact ? <span className="sr-only">{label}</span> : label}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Not built yet: one quiet line instead of a row of disabled items to tap on. */}
        {!compact && (
          <div className="mt-6 space-y-1 px-3 text-xs text-sidebar-muted">
            <p className="font-medium">Coming soon</p>
            <ul>
              {NAV.filter((n) => !n.href).map(({ label, unavailableReason }) => (
                <li key={label}>
                  {label}
                  <span className="sr-only">: {unavailableReason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {compact ? (
        <div className="flex justify-center border-t border-sidebar-hover py-4" title="WhatsApp setup pending · Supported by Fylix">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          <span className="sr-only">WhatsApp setup pending. Supported by Fylix.</span>
        </div>
      ) : (
        <div className="space-y-3 border-t border-sidebar-hover px-5 py-4 text-xs">
          <p className="flex items-center gap-2 text-sidebar-ink">
            <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
            WhatsApp setup pending
          </p>
          <p className="text-sidebar-muted">Supported by Fylix</p>
        </div>
      )}
    </div>
  )
}

/** Fixed sidebar from md up (full or compact rail); a slide-in drawer with full labels on phones. */
export default function AppSidebar({
  active,
  compact = false,
  drawerOpen,
  onCloseDrawer,
}: {
  active: string
  compact?: boolean
  drawerOpen: boolean
  onCloseDrawer: () => void
}) {
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseDrawer()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, onCloseDrawer])

  return (
    <>
      <aside className={`sticky top-0 hidden h-screen shrink-0 md:block ${compact ? 'w-16' : 'w-56'}`}>
        <SidebarContents active={active} compact={compact} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button aria-label="Close navigation" onClick={onCloseDrawer} className="absolute inset-0 bg-black/40" />
          <div className="relative h-full w-64 shadow-xl">
            <SidebarContents active={active} onNavigate={onCloseDrawer} />
            <button
              onClick={onCloseDrawer}
              aria-label="Close navigation"
              autoFocus
              className="absolute right-3 top-4 rounded-md p-1 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-ink focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
