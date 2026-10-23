import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import { DARK_CASTLE_VISUAL_SHA256 } from '@/lib/social-approved-visual-contract'
import { darkCastleVisualQaFixtureEnabled } from '@/lib/social-dark-castle-visual-qa-fixture'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!darkCastleVisualQaFixtureEnabled()) return new NextResponse(null, { status: 404 })
  try {
    const png = await readFile(path.join(process.cwd(), 'artifacts/human-qa/dark-castle-youtube-visual-contract-2026-10-23/review.png'))
    if (createHash('sha256').update(png).digest('hex') !== DARK_CASTLE_VISUAL_SHA256) {
      return NextResponse.json({ error: 'The reviewed PNG hash does not match its approved receipt.' }, { status: 409 })
    }
    return new NextResponse(new Uint8Array(png), {
      headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' },
    })
  } catch {
    return NextResponse.json({ error: 'The local approved review image is unavailable.' }, { status: 404 })
  }
}
