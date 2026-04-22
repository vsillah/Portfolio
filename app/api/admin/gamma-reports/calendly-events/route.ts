/**
 * GET /api/admin/gamma-reports/calendly-events
 *
 * Returns the 6 Calendly event options (key, label, duration, blurb, resolved
 * URL) for the admin Gamma report generator's "Next meeting" dropdown. URLs
 * are resolved server-side so non-public env vars (e.g. CALENDLY_ONBOARDING_CALL_URL)
 * never need to reach the client, and the admin can verify which URL will
 * actually render on the deck before clicking Generate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  CALENDLY_EVENT_KEYS,
  CALENDLY_EVENT_META,
  DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE,
  getCalendlyUrlForEvent,
} from '@/lib/calendly-events'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const events = CALENDLY_EVENT_KEYS.map((key) => {
    const meta = CALENDLY_EVENT_META[key]
    const url = getCalendlyUrlForEvent(key)
    const isConfigured = Boolean(process.env[meta.envVar]?.trim())
    return {
      key: meta.key,
      label: meta.label,
      duration: meta.duration,
      blurb: meta.blurb,
      envVar: meta.envVar,
      url,
      isConfigured,
    }
  })

  return NextResponse.json({
    events,
    defaultsByReportType: DEFAULT_CALENDLY_EVENT_FOR_REPORT_TYPE,
  })
}
