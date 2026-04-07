import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const defaultThemeId = process.env.GAMMA_DEFAULT_THEME_ID || null
  const apiKey = process.env.GAMMA_API_KEY

  // Degrade gracefully: UI only needs an empty list + optional default theme id (avoids console 500 noise).
  if (!apiKey) {
    console.warn('[gamma-themes] GAMMA_API_KEY not set — themes list skipped')
    return NextResponse.json({ themes: [], defaultThemeId })
  }

  try {
    const res = await fetch(`${GAMMA_API_BASE}/themes`, {
      headers: { 'X-API-KEY': apiKey },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const msg =
        (errBody as Record<string, unknown>).message != null
          ? String((errBody as Record<string, unknown>).message)
          : `Gamma API ${res.status}`
      console.error('[gamma-themes] Gamma /themes request failed:', msg)
      return NextResponse.json({ themes: [], defaultThemeId, warning: msg })
    }

    const body = await res.json()
    const themes = Array.isArray(body) ? body : (body.data ?? [])

    return NextResponse.json({ themes, defaultThemeId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[gamma-themes] Themes fetch error:', msg)
    return NextResponse.json({ themes: [], defaultThemeId, warning: msg })
  }
}
