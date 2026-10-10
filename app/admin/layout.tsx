'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle, Menu, X } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import AdminSidebar from '@/components/admin/AdminSidebar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const prevPathnameRef = useRef(pathname)

  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      const wasOpen = drawerOpen
      prevPathnameRef.current = pathname
      setDrawerOpen(false)
      if (wasOpen) requestAnimationFrame(() => hamburgerRef.current?.focus())
    }
  }, [pathname, drawerOpen])

  const closeDrawer = () => setDrawerOpen(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const focusable =
      drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      ) ?? []
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground" data-testid="admin-layout">
      {/* Desktop sidebar */}
      <aside className="hidden h-full shrink-0 lg:flex">
        <AdminSidebar />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm dark:bg-black/60 lg:hidden"
          aria-hidden
          onClick={closeDrawer}
        />
      )}

      {/* Mobile drawer */}
      <aside
        ref={drawerRef}
        className={`fixed left-0 top-0 z-[60] h-full w-[284px] transform overflow-hidden border-r border-border bg-card text-card-foreground shadow-[16px_0_48px_rgba(18,30,49,0.16)] transition-transform duration-200 ease-out dark:shadow-[16px_0_48px_rgba(0,0,0,0.28)] lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Admin navigation"
        aria-modal="true"
        role="dialog"
        hidden={!drawerOpen}
        data-testid="admin-mobile-drawer"
      >
        <div className="flex items-center justify-between border-b border-border bg-card/95 p-4" data-testid="admin-mobile-drawer-header">
          <div>
            <div className="mb-0.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-bronze dark:text-radiant-gold">
              Admin
            </div>
            <span className="text-base font-semibold text-foreground">Command Center</span>
          </div>
          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-radiant-gold/40 hover:bg-radiant-gold/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto">
          <AdminSidebar showHeader={false} />
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:px-6">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-radiant-gold/40 hover:bg-radiant-gold/10 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold lg:hidden"
            aria-label="Open admin menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1 lg:flex-initial" />
          <Link
            href="/admin/help"
            className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:border-radiant-gold/20 hover:bg-radiant-gold/10 hover:text-foreground"
          >
            <HelpCircle size={18} />
            Help
          </Link>
        </header>
        <main id="admin-main" className="min-h-0 min-w-0 flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
