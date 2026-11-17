import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { isAuthError, verifyAdmin } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: { slide: string } }) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (!/^slide-0[1-8]\.png$/.test(params.slide)) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })

  try {
    const bytes = await readFile(path.join(process.cwd(), 'private-review-assets/accelerated-campaign/carousel-faster-output', params.slide))
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Asset unavailable' }, { status: 404 })
  }
}
