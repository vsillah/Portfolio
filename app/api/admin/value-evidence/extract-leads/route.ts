import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerValueEvidenceExtraction } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

const MAX_LEADS = 50

interface ContactMapValue {
  message: string | null
  quick_wins: string | null
  full_report: string | null
  rep_pain_points: string | null
}

interface LeadEnrichment {
  contact_submission_id: number
  rep_pain_points?: string
  message?: string
  quick_wins?: string
  industry?: string
  employee_count?: string
  company?: string
  company_domain?: string
}

/**
 * POST /api/admin/value-evidence/extract-leads
 * Accept enrichments per lead, persist to contact_submissions, set push status, trigger n8n.
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
    const leadsInput = body.leads as unknown

    if (!Array.isArray(leadsInput) || leadsInput.length === 0) {
      return NextResponse.json(
        { error: 'leads is required and must be a non-empty array' },
        { status: 400 }
      )
    }

    const leads: LeadEnrichment[] = leadsInput
      .filter((item: unknown): item is LeadEnrichment => {
        return (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as LeadEnrichment).contact_submission_id === 'number' &&
          Number.isInteger((item as LeadEnrichment).contact_submission_id) &&
          (item as LeadEnrichment).contact_submission_id > 0
        )
      })

    if (leads.length > MAX_LEADS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_LEADS} leads per request` },
        { status: 400 }
      )
    }
    if (leads.length === 0) {
      return NextResponse.json(
        { error: 'Each lead must have a valid contact_submission_id (positive integer)' },
        { status: 400 }
      )
    }

    const ids = [...new Set(leads.map((l) => l.contact_submission_id))]

    const { data: contacts, error: fetchError } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, message, quick_wins, full_report, rep_pain_points')
      .in('id', ids)

    if (fetchError) {
      console.error('Extract-leads fetch contacts error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const contactMap = new Map<number, ContactMapValue>(
      (contacts || []).map((c: { id: number; message: string | null; quick_wins: string | null; full_report: string | null; rep_pain_points: string | null }) => [
        c.id,
        {
          message: c.message?.trim() || null,
          quick_wins: c.quick_wins?.trim() || null,
          full_report: c.full_report?.trim() || null,
          rep_pain_points: c.rep_pain_points?.trim() || null,
        },
      ])
    )

    const { data: completedAudits } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('contact_submission_id')
      .in('contact_submission_id', ids)
      .eq('status', 'completed')

    const hasDiagnosticSet = new Set(
      (completedAudits || []).map((a: { contact_submission_id: number }) => a.contact_submission_id)
    )

    for (const lead of leads) {
      const id = lead.contact_submission_id
      const existing = contactMap.get(id)
      if (!existing) continue

      const updatePayload: Record<string, unknown> = {}
      if (lead.rep_pain_points !== undefined) {
        const v = lead.rep_pain_points?.trim() || null
        updatePayload.rep_pain_points = v
        existing.rep_pain_points = v
      }
      if (lead.message !== undefined) {
        const v = lead.message?.trim() || null
        updatePayload.message = v
        existing.message = v
      }
      if (lead.quick_wins !== undefined) {
        const v = lead.quick_wins?.trim() || null
        updatePayload.quick_wins = v
        existing.quick_wins = v
      }
      if (lead.industry !== undefined) {
        updatePayload.industry = lead.industry?.trim() || null
      }
      if (lead.employee_count !== undefined) {
        updatePayload.employee_count = lead.employee_count?.trim() || null
      }
      if (lead.company !== undefined) {
        updatePayload.company = lead.company?.trim() || null
      }
      if (lead.company_domain !== undefined) {
        updatePayload.company_domain = lead.company_domain?.trim() || null
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from('contact_submissions')
          .update(updatePayload)
          .eq('id', id)

        if (updateError) {
          console.error('Extract-leads update contact error:', id, updateError)
        }
      }
    }

    const extractable: number[] = []
    const skipped: number[] = []
    const skippedReasons: Record<number, string> = {}

    for (const id of ids) {
      const existing = contactMap.get(id)
      const has_diagnostic = hasDiagnosticSet.has(id)
      const hasText =
        (existing?.message && existing.message.length > 0) ||
        (existing?.quick_wins && existing.quick_wins.length > 0) ||
        (existing?.full_report && existing.full_report.length > 0) ||
        (existing?.rep_pain_points && existing.rep_pain_points.length > 0) ||
        has_diagnostic

      if (hasText) {
        extractable.push(id)
      } else {
        skipped.push(id)
        skippedReasons[id] = 'No extractable text (message, quick_wins, full_report, rep_pain_points) or completed diagnostic'
      }
    }

    if (extractable.length > 0) {
      const { error: statusError } = await supabaseAdmin
        .from('contact_submissions')
        .update({
          last_vep_triggered_at: new Date().toISOString(),
          last_vep_status: 'pending',
        })
        .in('id', extractable)

      if (statusError) {
        console.error('Extract-leads set status error:', statusError)
      }

      const enrichments: Record<number, { pain_points_freetext?: string }> = {}
      for (const lead of leads) {
        if (extractable.includes(lead.contact_submission_id) && lead.rep_pain_points?.trim()) {
          enrichments[lead.contact_submission_id] = {
            pain_points_freetext: lead.rep_pain_points.trim(),
          }
        }
      }

      const result = await triggerValueEvidenceExtraction({
        contactSubmissionIds: extractable,
        enrichments: Object.keys(enrichments).length > 0 ? enrichments : undefined,
      })

      if (!result.triggered) {
        return NextResponse.json(
          {
            triggered: false,
            message: result.message,
            extractable,
            skipped,
            skippedReasons,
          },
          { status: 200 }
        )
      }

      return NextResponse.json({
        triggered: true,
        message: `Triggered extraction for ${extractable.length} lead(s).${skipped.length > 0 ? ` ${skipped.length} skipped (no extractable data).` : ''}`,
        extractable,
        skipped,
        skippedReasons,
      })
    }

    return NextResponse.json({
      triggered: false,
      message: skipped.length > 0 ? `No extractable data for selected leads. ${skipped.length} skipped.` : 'No leads to extract.',
      extractable: [],
      skipped,
      skippedReasons,
    })
  } catch (err) {
    console.error('Extract-leads error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extract failed' },
      { status: 500 }
    )
  }
}
