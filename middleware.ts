import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ALLOWED_ORIGINS = new Set([
  'https://amadutown.com',
  'https://www.amadutown.com',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
])

export async function middleware(req: NextRequest) {
  // CORS gate for chat API routes (mutating methods only)
  if (req.nextUrl.pathname.startsWith('/api/chat') && req.method !== 'GET') {
    const origin = req.headers.get('origin')
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 },
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/chat/:path*'],
}
