'use client'

export default function DevBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV === 'production') return null
  if (!process.env.NEXT_PUBLIC_APP_ENV) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black text-center text-xs font-bold py-0.5 pointer-events-none select-none tracking-widest uppercase">
      dev environment
    </div>
  )
}
