import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TEST_CONTACT_EMAILS = [
  'test-discovery@example.com',
  'test-lead-qual-99999@example.com',
]

const TEST_CLIENT_EMAILS = [
  'test-onboarding@example.com',
  'test-kickoff@example.com',
  'test-stripe@example.com',
]

/**
 * POST /api/admin/testing/cleanup-seeds
 * Deletes known test seed rows from contact_submissions and client_projects.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const results: Record<string, number> = {}

    const { data: contacts, error: contactErr } = await supabaseAdmin
      .from('contact_submissions')
      .delete()
      .in('email', TEST_CONTACT_EMAILS)
      .select('id')

    if (contactErr) {
      console.error('Cleanup contact_submissions error:', contactErr)
    }
    results.contact_submissions = contacts?.length ?? 0

    const { data: projects, error: projectErr } = await supabaseAdmin
      .from('client_projects')
      .delete()
      .in('client_email', TEST_CLIENT_EMAILS)
      .select('id')

    if (projectErr) {
      console.error('Cleanup client_projects error:', projectErr)
    }
    results.client_projects = projects?.length ?? 0

    const totalDeleted = Object.values(results).reduce((a, b) => a + b, 0)

    return NextResponse.json({
      success: true,
      totalDeleted,
      details: results,
    })
  } catch (err) {
    console.error('Cleanup seeds error:', err)
    return NextResponse.json(
      { error: 'Something went wrong cleaning up test data.' },
      { status: 500 }
    )
  }
}
