import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const GAMMA_API_BASE = 'https://public-api.gamma.app/v1.0'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const apiKey = process.env.GAMMA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GAMMA_API_KEY not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(`${GAMMA_API_BASE}/themes`, {
      headers: { 'X-API-KEY': apiKey },
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (errBody as Record<string, string>).message || `Gamma API ${res.status}` },
        { status: res.status }
      )
    }

    const body = await res.json()
    const themes = Array.isArray(body) ? body : (body.data ?? [])
    const defaultThemeId = process.env.GAMMA_DEFAULT_THEME_ID || null

    return NextResponse.json({ themes, defaultThemeId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
