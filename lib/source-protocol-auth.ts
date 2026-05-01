import { NextResponse } from 'next/server'

export function requireSourceProtocolBearer(authHeader: string | null): NextResponse | null {
  const expectedSecret = process.env.SOURCE_PROTOCOL_INGEST_SECRET
  const token = authHeader?.replace(/^Bearer\s+/i, '')

  if (!expectedSecret || token !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
