'use client'

import Link from 'next/link'
import { HelpCircle } from 'lucide-react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 flex items-center justify-end border-b border-gray-800 bg-black/95 px-6 py-3">
        <Link
          href="/admin/help"
          className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <HelpCircle size={18} />
          Help
        </Link>
      </header>
      {children}
    </div>
  )
}
