import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const ALLOWED_PREFIXES = [
  'docs/agentic-content-review-packets/',
  'docs/agentic-content-video-scripts/',
  'docs/agentic-content-linkedin-drafts/',
]

function normalizePacketPath(rawPath: string | null) {
  const packetPath = (rawPath ?? '').trim()
  if (!packetPath.endsWith('.md')) return null
  if (packetPath.includes('\0')) return null

  const normalized = path.posix.normalize(packetPath).replace(/^\/+/, '')
  if (normalized.startsWith('../')) return null
  if (!ALLOWED_PREFIXES.some(prefix => normalized.startsWith(prefix))) return null
  return normalized
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const packetPath = normalizePacketPath(searchParams.get('path'))
  if (!packetPath) {
    return NextResponse.json({ error: 'Invalid evidence packet path' }, { status: 400 })
  }

  const repoRoot = process.cwd()
  const fullPath = path.resolve(repoRoot, packetPath)
  if (!fullPath.startsWith(repoRoot + path.sep)) {
    return NextResponse.json({ error: 'Invalid evidence packet path' }, { status: 400 })
  }

  try {
    const content = await readFile(fullPath, 'utf8')
    return NextResponse.json({ path: packetPath, content })
  } catch (error) {
    console.error('[video-generation evidence-packet] read failed:', error)
    return NextResponse.json({ error: 'Evidence packet not found' }, { status: 404 })
  }
}
