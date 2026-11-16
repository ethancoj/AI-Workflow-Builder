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

const NAV: NavItem[] = [
  { label: 'Overview', Icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Workflows', Icon: Workflow, href: '/builder' },
  { label: 'Quote Requests', Icon: Inbox, unavailableReason: 'A full quote inbox is coming soon. Recent quotes are on the Overview.' },
  { label: 'Conversations', Icon: MessagesSquare, unavailableReason: 'Available once WhatsApp is connected.' },
  { label: 'Pricing Rubric', Icon: Calculator, href: '/quotes' },
  { label: 'Settings', Icon: Settings, unavailableReason: 'Settings are coming soon.' },
]

function SidebarContents({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-navy text-slate-200">
      <div className="px-5 py-5">
        <p className="text-base font-semibold text-white">AI Workflow Builder</p>
      </div>

      <nav aria-label="Main" className="flex-1 px-3">
        <ul className="space-y-1">
          {NAV.map(({ label, Icon, href, unavailableReason }) => {
            const isActive = href === active
            const base =
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-300'
            return (
              <li key={label}>
                {href ? (
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={`${base} ${isActive ? 'bg-teal font-medium text-white' : 'hover:bg-navy-soft hover:text-white'}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {label}
                  </Link>
                ) : (
                  // Not built yet: visible but clearly unavailable, with the reason on hover and for screen readers.
                  <span aria-disabled="true" title={unavailableReason} className={`${base} cursor-not-allowed text-slate-400`}>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1">{label}</span>
                    <span className="rounded bg-navy-soft px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                      Soon
                    </span>
                    <span className="sr-only">: {unavailableReason}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="space-y-3 border-t border-navy-soft px-5 py-4 text-xs">
        <p className="flex items-center gap-2 text-slate-300">
          <span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />
          WhatsApp setup pending
        </p>
        <p className="text-slate-400">Supported by Fylix</p>
      </div>
    </div>
  )
}

/** Fixed sidebar from md up; a slide-in drawer on phones (controlled by the page). */
export default function DashboardSidebar({
  active,
  drawerOpen,
  onCloseDrawer,
}: {
  active: string
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
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 md:block">
        <SidebarContents active={active} />
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
              className="absolute right-3 top-4 rounded-md p-1 text-slate-300 hover:bg-navy-soft hover:text-white focus-visible:ring-2 focus-visible:ring-teal-300"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
