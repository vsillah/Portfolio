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
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex shrink-0 sticky top-0 h-screen">
        <AdminSidebar />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-hidden
          onClick={closeDrawer}
        />
      )}

      {/* Mobile drawer */}
      <aside
        ref={drawerRef}
        className={`fixed top-0 left-0 z-50 h-full w-[280px] bg-silicon-slate/95 border-r border-silicon-slate transform transition-transform duration-200 ease-out lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Admin navigation"
        aria-modal="true"
        role="dialog"
        hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between p-3 border-b border-silicon-slate">
          <span className="text-sm font-medium text-platinum-white/80">Menu</span>
          <button
            type="button"
            onClick={closeDrawer}
            className="p-2 rounded-lg text-platinum-white/80 hover:bg-silicon-slate hover:text-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto h-[calc(100%-52px)]">
          <AdminSidebar />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-silicon-slate bg-background px-4 py-3 lg:px-6">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 rounded-lg text-platinum-white/80 hover:bg-silicon-slate hover:text-foreground focus:outline-none focus:ring-2 focus:ring-radiant-gold"
            aria-label="Open admin menu"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1 lg:flex-initial" />
          <Link
            href="/admin/help"
            className="flex items-center gap-2 text-sm text-platinum-white/80 transition-colors hover:text-foreground"
          >
            <HelpCircle size={18} />
            Help
          </Link>
        </header>
        <main id="admin-main" className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
