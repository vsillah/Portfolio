'use client'

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-end border-b border-silicon-slate bg-background/95 px-6 py-3">
        <Link
          href="/admin/help"
          className="flex items-center gap-2 text-sm text-platinum-white/80 transition-colors hover:text-foreground"
        >
          <HelpCircle size={18} />
          Help
        </Link>
      </header>
      {children}
    </div>
  )
}
