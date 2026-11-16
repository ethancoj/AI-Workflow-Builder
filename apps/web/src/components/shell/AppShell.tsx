'use client'

import { Menu } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useSession } from '@/components/auth/RequireAuth'
import { supabase } from '@/lib/supabase'
import AppSidebar from './AppSidebar'

type ShellValue = { openNav: () => void; merchantName?: string }

const ShellContext = createContext<ShellValue>({ openNav: () => {} })

/** The merchant's business name (once loaded) and a way to open the phone nav drawer. */
export const useShell = () => useContext(ShellContext)

/** Hamburger that opens the nav drawer. Only visible below md, where the sidebar is hidden. */
export function NavButton() {
  const { openNav } = useShell()
  return (
    <button
      onClick={openNav}
      aria-label="Open navigation"
      className="rounded-md p-1.5 text-ink hover:bg-page focus-visible:ring-2 focus-visible:ring-brand md:hidden"
    >
      <Menu className="h-5 w-5" aria-hidden />
    </button>
  )
}

/**
 * Layout shared by every logged-in merchant page: sidebar + page content.
 * Must be inside <RequireAuth>. Pinned to the light palette regardless of OS theme.
 */
export default function AppShell({
  active,
  compact = false,
  children,
}: {
  /** Route of the current page, highlighted in the nav. */
  active: string
  /** Icon-only sidebar, for pages that need the width (the builder). */
  compact?: boolean
  children: ReactNode
}) {
  const session = useSession()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [merchantName, setMerchantName] = useState<string>()
  const openNav = useCallback(() => setDrawerOpen(true), [])
  const closeNav = useCallback(() => setDrawerOpen(false), [])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('merchants')
      .select('name')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.name) setMerchantName(data.name)
      })
    return () => {
      cancelled = true
    }
  }, [session.user.id])

  return (
    <ShellContext.Provider value={{ openNav, merchantName }}>
      <div className="theme-light flex min-h-screen bg-page text-sm text-ink">
        <AppSidebar active={active} compact={compact} drawerOpen={drawerOpen} onCloseDrawer={closeNav} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </ShellContext.Provider>
  )
}
