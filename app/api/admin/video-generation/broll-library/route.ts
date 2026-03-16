/**
 * GET /api/admin/video-generation/broll-library
 * Returns all B-roll library entries.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { data, error } = await supabaseAdmin
      .from('broll_library')
      .select('*')
      .order('route', { ascending: true })

    if (error) {
      console.error('[broll-library] Fetch error:', error)
      return NextResponse.json({ error: 'Failed to fetch B-roll library' }, { status: 500 })
    }

    return NextResponse.json({ assets: data ?? [] })
  } catch (error) {
    console.error('[broll-library] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
