'use client'

import { useEffect } from 'react'

type StrategyDemoLauncherProps = {
  dashboardUrl: string
}

export default function StrategyDemoLauncher({ dashboardUrl }: StrategyDemoLauncherProps) {
  useEffect(() => {
    const redirectTimer = window.setTimeout(() => {
      window.location.replace(dashboardUrl)
    }, 250)

    return () => window.clearTimeout(redirectTimer)
  }, [dashboardUrl])

  return (
    <a
      className="inline-flex items-center rounded-md bg-emerald-400 px-5 py-3 text-base font-semibold text-slate-950 transition hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:ring-offset-2 focus:ring-offset-slate-950"
      href={dashboardUrl}
    >
      Launch dashboard
    </a>
  )
}
