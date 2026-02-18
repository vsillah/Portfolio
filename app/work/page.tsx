'use client'

import { useEffect, useState } from 'react'
import Navigation from '@/components/Navigation'
import Projects from '@/components/Projects'
import AppPrototypes from '@/components/AppPrototypes'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { analytics } from '@/lib/analytics'

export default function WorkPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    analytics.pageView()
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <main className="min-h-screen relative">
      <Navigation />
      {/* Back to home / bio */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 pt-24 pb-4">
        <Link
          href="/#about"
          className="inline-flex items-center gap-2 text-platinum-white/70 hover:text-radiant-gold text-sm font-medium transition-colors"
        >
          <ArrowLeft size={16} />
          Back to about
        </Link>
      </div>
      <Projects />
      <AppPrototypes />
    </main>
  )
}
