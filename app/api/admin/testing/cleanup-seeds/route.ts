import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TEST_CONTACT_EMAILS = [
  'test-discovery@example.com',
  'test-lead-qual-99999@example.com',
  'sarah.mitchell@techflow.io',
  'demo-warm1@example.com',
  'demo-warm2@example.com',
  'demo-cold@example.com',
  'demo-discovery@example.com',
]

const TEST_CLIENT_EMAILS = [
  'test-onboarding@example.com',
  'test-kickoff@example.com',
  'test-stripe@example.com',
]

const TABLES_WITH_TEST_FLAG = [
  'pain_point_evidence',
  'market_intelligence',
  'cost_events',
  'outreach_queue',
  'social_content_queue',
  'meeting_records',
  'sales_sessions',
  'client_projects',
  'contact_submissions',
] as const

/**
 * POST /api/admin/testing/cleanup-seeds
 * Deletes known test seed rows from contact_submissions and client_projects.
 * Also purges all rows where is_test_data = true across flagged tables.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const mode: 'all' | 'email_only' | 'flag_only' = body.mode ?? 'all'

    const results: Record<string, number> = {}

    // Phase 1: Delete by is_test_data flag
    if (mode === 'all' || mode === 'flag_only') {
      for (const table of TABLES_WITH_TEST_FLAG) {
        const { data, error } = await supabaseAdmin
          .from(table)
          .delete()
          .eq('is_test_data', true)
          .select('id')

        if (error) {
          // Dev DBs without migrations/2026_03_21_add_is_test_data.sql have no column
          if (error.code !== '42703') {
            console.error(`Cleanup ${table} (is_test_data) error:`, error)
          }
          results[`${table}_flagged`] = 0
        } else {
          results[`${table}_flagged`] = data?.length ?? 0
        }
      }
    }

    // Phase 2: Delete by known test emails (legacy approach)
    if (mode === 'all' || mode === 'email_only') {
      const { data: contactRows } = await supabaseAdmin
        .from('contact_submissions')
        .select('id')
        .in('email', TEST_CONTACT_EMAILS)

      const contactIds = (contactRows ?? []).map((r: { id: number }) => r.id)
      if (contactIds.length > 0) {
        await supabaseAdmin.from('diagnostic_audits').delete().in('contact_submission_id', contactIds)
      }
      await supabaseAdmin.from('diagnostic_audits').delete().eq('session_id', 'test-lead-session-001')
      await supabaseAdmin.from('chat_sessions').delete().eq('session_id', 'test-lead-session-001')

      const { data: contacts, error: contactErr } = await supabaseAdmin
        .from('contact_submissions')
        .delete()
        .in('email', TEST_CONTACT_EMAILS)
        .select('id')

      if (contactErr) {
        console.error('Cleanup contact_submissions error:', contactErr)
      }
      results.contact_submissions_email = contacts?.length ?? 0

      const { data: proposalsRemoved, error: proposalErr } = await supabaseAdmin
        .from('proposals')
        .delete()
        .eq('client_email', 'jordan@acmecorp.com')
        .select('id')
      if (proposalErr) {
        console.error('Cleanup proposals error:', proposalErr)
      }
      results.proposals = proposalsRemoved?.length ?? 0

      const { data: projects, error: projectErr } = await supabaseAdmin
        .from('client_projects')
        .delete()
        .in('client_email', TEST_CLIENT_EMAILS)
        .select('id')

      if (projectErr) {
        console.error('Cleanup client_projects error:', projectErr)
      }
      results.client_projects_email = projects?.length ?? 0
    }

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
