import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { printful } from '@/lib/printful'

export const dynamic = 'force-dynamic'

function getWebhookBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL?.trim()) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'http://localhost:3000'
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const config = await printful.getWebhookConfig()
    return NextResponse.json(config ?? { url: null, types: [] })
  } catch (err) {
    console.error('[admin/printful/webhook] GET failed:', err)
    return NextResponse.json(
      { error: 'Failed to fetch webhook config' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({})) as { url?: string }
    const baseUrl = getWebhookBaseUrl()
    const url = typeof body?.url === 'string' && body.url.trim()
      ? body.url.trim()
      : `${baseUrl}/api/webhooks/printful`

    const result = await printful.setWebhookConfig({
      url,
      types: ['package_shipped'],
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/printful/webhook] POST failed:', err)
    return NextResponse.json(
      { error: 'Failed to set webhook config' },
      { status: 500 }
    )
  }
}
