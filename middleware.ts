import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [], // No routes protected by middleware - using client-side ProtectedRoute instead
}
