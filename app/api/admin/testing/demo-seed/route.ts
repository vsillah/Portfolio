import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { isDemoSeedKey, runDemoSeed } from '@/lib/admin-demo-seed'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/testing/demo-seed
 * Body: { key: DemoSeedKey } — creates demo rows previously seeded via SQL (E2E-friendly).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 503 })
    }

    const body = await request.json().catch(() => ({}))
    const key = body?.key as string | undefined

    if (!key || !isDemoSeedKey(key)) {
      return NextResponse.json(
        {
          error: 'Invalid or missing key',
          validKeys: [
            'sarah_mitchell_lead',
            'paid_proposal_jordan',
            'lead_qualification_99999',
            'onboarding_test_project',
            'kickoff_test_project',
            'discovery_call_test_contact',
          ],
        },
        { status: 400 }
      )
    }

    const result = await runDemoSeed(key, supabaseAdmin)

    if (!result.ok) {
      console.error('[demo-seed]', key, result.error)
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      key: result.key,
      detail: result.detail,
    })
  } catch (err) {
    console.error('demo-seed error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
