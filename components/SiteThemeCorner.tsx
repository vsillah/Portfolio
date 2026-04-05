'use client'

import ThemeToggle from '@/components/ThemeToggle'

/** Fixed theme control for pages without the main nav (auth, etc.). */
export default function SiteThemeCorner() {
  return (
    <div className="fixed top-4 right-4 z-[100] flex items-center gap-2 pointer-events-auto">
      <ThemeToggle />
    </div>
  )
}
