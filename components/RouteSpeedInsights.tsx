'use client'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { usePathname } from 'next/navigation'
const privatePath = (path: string) => path.startsWith('/proposal/') || path.startsWith('/client/dashboard/') || path.startsWith('/admin/sales/proposals/')
/** Bearer client links and proposal review content must not enter telemetry. */
export default function RouteSpeedInsights() {
  const path = usePathname()
  if (!path || privatePath(path)) return null
  return <SpeedInsights beforeSend={event => privatePath(window.location.pathname) ? null : event} />
}
