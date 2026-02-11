import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

const MAX_IDS = 50

export interface PreflightLead {
  id: number
  name: string
  company: string | null
  industry: string | null
  employee_count: string | null
  message: string | null
  quick_wins: string | null
  full_report: string | null
  rep_pain_points: string | null
  has_diagnostic: boolean
  has_extractable_text: boolean
}

/**
 * POST /api/admin/value-evidence/extract-leads/preflight
 * Read-only. Returns per-lead data for the Review & Enrich modal.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const body = await request.json().catch(() => ({}))
    const contact_submission_ids = body.contact_submission_ids as unknown

    if (!Array.isArray(contact_submission_ids) || contact_submission_ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_submission_ids is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const ids = contact_submission_ids.filter(
      (id: unknown): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0
    )
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IDS} contact IDs per request` },
        { status: 400 }
      )
    }
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'contact_submission_ids must contain valid positive integers' },
        { status: 400 }
      )
    }

    const uniqueIds = [...new Set(ids)]

    const { data: contacts, error: fetchError } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, company, industry, employee_count, message, quick_wins, full_report, rep_pain_points')
      .in('id', uniqueIds)

    if (fetchError) {
      console.error('Preflight fetch contacts error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const idSet = new Set((contacts || []).map((c: { id: number }) => c.id))

    const { data: completedAudits } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('contact_submission_id')
      .in('contact_submission_id', uniqueIds)
      .eq('status', 'completed')

    const contactIdsWithDiagnostic = new Set(
      (completedAudits || []).map((a: { contact_submission_id: number }) => a.contact_submission_id)
    )

    const leads: PreflightLead[] = (contacts || []).map((c: {
      id: number
      name: string
      company: string | null
      industry: string | null
      employee_count: string | null
      message: string | null
      quick_wins: string | null
      full_report: string | null
      rep_pain_points: string | null
    }) => {
      const message = c.message?.trim() || null
      const quick_wins = c.quick_wins?.trim() || null
      const fullReportRaw = c.full_report?.trim() || null
      const full_report = fullReportRaw
        ? fullReportRaw.length > 200
          ? fullReportRaw.slice(0, 200) + '...'
          : fullReportRaw
        : null
      const rep_pain_points = c.rep_pain_points?.trim() || null
      const has_diagnostic = contactIdsWithDiagnostic.has(c.id)
      const has_extractable_text =
        !!message ||
        !!quick_wins ||
        !!fullReportRaw ||
        !!rep_pain_points ||
        has_diagnostic

      return {
        id: c.id,
        name: c.name || '',
        company: c.company || null,
        industry: c.industry || null,
        employee_count: c.employee_count?.trim() || null,
        message,
        quick_wins,
        full_report,
        rep_pain_points,
        has_diagnostic,
        has_extractable_text,
      }
    })

    return NextResponse.json({ leads })
  } catch (err) {
    console.error('Preflight error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Preflight failed' },
      { status: 500 }
    )
  }
}
