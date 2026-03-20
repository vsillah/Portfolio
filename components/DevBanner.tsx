'use client'

export default function DevBanner() {
  const env = process.env.NEXT_PUBLIC_APP_ENV
  if (env === 'production') return null
  if (!env) return null

  const isStaging = env === 'staging'
  const label = isStaging ? 'staging' : env === 'development' ? 'dev environment' : env

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] text-black text-center text-xs font-bold py-0.5 pointer-events-none select-none tracking-widest uppercase ${
        isStaging ? 'bg-orange-500' : 'bg-amber-500'
      }`}
    >
      {label}
    </div>
  )
}
