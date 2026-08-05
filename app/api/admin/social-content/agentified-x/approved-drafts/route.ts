import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { seedAgentifiedXApprovedDrafts } from '@/lib/agentified-x-approved-drafts'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  try {
    const result = await seedAgentifiedXApprovedDrafts({
      admin: supabaseAdmin,
      reviewedByUserId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[agentified-x-approved-drafts] seed failed:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to seed Agentified X approved drafts',
    }, { status: 500 })
  }
}
