import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerLeadQualificationWebhook } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

const INPUT_TYPE_TO_LEAD_SOURCE: Record<string, string> = {
  linkedin: 'cold_linkedin',
  referral: 'cold_referral',
  business_card: 'cold_business_card',
  event: 'cold_event',
  other: 'other',
}
function leadSourceFromInputType(inputType: string | undefined): string {
  if (inputType && inputType in INPUT_TYPE_TO_LEAD_SOURCE) {
    return INPUT_TYPE_TO_LEAD_SOURCE[inputType]
  }
  return 'cold_referral'
}

function normalizeUrl(url: string | undefined): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()
  if (trimmed.match(/^https?:\/\//i)) return trimmed
  return `https://${trimmed}`
}

/**
 * GET /api/admin/outreach/leads/[id]
 * Fetch a single lead (contact_submission) by id. Used by conversation page to load contact.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, company_domain, job_title, industry, phone_number, linkedin_url, message, lead_source, employee_count, do_not_contact, removed_at')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/leads/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/outreach/leads/[id]
 * Update a lead by id. Optionally re-trigger lead qualification webhook for enrichment.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { id: idParam } = await params
    const id = parseInt(idParam, 10)
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid lead id' }, { status: 400 })
    }

    const body = await request.json()
    const {
      name,
      email,
      company,
      company_domain,
      linkedin_url,
      linkedin_username,
      job_title,
      industry,
      location,
      phone_number,
      message: bodyMessage,
      notes,
      input_type,
      re_run_enrichment,
      employee_count,
      quick_wins,
      rep_pain_points,
      do_not_contact,
      removed_at,
    } = body as {
      name?: string
      email?: string
      company?: string
      company_domain?: string
      linkedin_url?: string
      linkedin_username?: string
      job_title?: string
      industry?: string
      location?: string
      phone_number?: string
      message?: string
      notes?: string
      input_type?: string
      re_run_enrichment?: boolean
      employee_count?: string
      quick_wins?: string
      rep_pain_points?: string
      do_not_contact?: boolean
      removed_at?: string | null
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, name, email, company, company_domain, job_title, industry, phone_number, linkedin_url, message, lead_source')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      )
    }

    const message = bodyMessage ?? notes ?? existing.message ?? ''

    if (email !== undefined && email !== null && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (email.trim() && !emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        )
      }
    }

    const normalizedLinkedinUrl = normalizeUrl(linkedin_url)
    const leadSource = leadSourceFromInputType(input_type)
    const displayMessage = message && typeof message === 'string' && message.trim()
      ? message.trim()
      : (existing.message ?? '')

    const updatePayload: Record<string, unknown> = {}
    if (name !== undefined) updatePayload.name = typeof name === 'string' ? name.trim() : null
    if (email !== undefined) updatePayload.email = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
    if (company !== undefined) updatePayload.company = typeof company === 'string' && company.trim() ? company.trim() : null
    if (company_domain !== undefined) updatePayload.company_domain = typeof company_domain === 'string' && company_domain.trim() ? company_domain.trim() : null
    if (job_title !== undefined) updatePayload.job_title = typeof job_title === 'string' && job_title.trim() ? job_title.trim() : null
    if (industry !== undefined) updatePayload.industry = typeof industry === 'string' && industry.trim() ? industry.trim() : null
    if (location !== undefined) updatePayload.location = typeof location === 'string' && location.trim() ? location.trim() : null
    if (phone_number !== undefined) updatePayload.phone_number = typeof phone_number === 'string' && phone_number.trim() ? phone_number.trim() : null
    if (linkedin_url !== undefined) updatePayload.linkedin_url = normalizedLinkedinUrl
    if (linkedin_username !== undefined) updatePayload.linkedin_username = typeof linkedin_username === 'string' && linkedin_username.trim() ? linkedin_username.trim() : null
    if (message !== undefined || notes !== undefined) updatePayload.message = displayMessage
    if (input_type !== undefined) {
      updatePayload.lead_source = leadSource
      updatePayload.warm_source_detail = input_type ? `Manual entry: ${input_type}` : null
    }
    if (employee_count !== undefined) updatePayload.employee_count = typeof employee_count === 'string' && employee_count.trim() ? employee_count.trim() : null
    if (quick_wins !== undefined) updatePayload.quick_wins = typeof quick_wins === 'string' && quick_wins.trim() ? quick_wins.trim() : null
    if (rep_pain_points !== undefined) updatePayload.rep_pain_points = typeof rep_pain_points === 'string' && rep_pain_points.trim() ? rep_pain_points.trim() : null

    // Do Not Contact: prevent re-ingest and exclude from outreach
    if (do_not_contact !== undefined) updatePayload.do_not_contact = Boolean(do_not_contact)
    // Removed: soft-delete; clear to restore
    if (removed_at !== undefined) updatePayload.removed_at = removed_at === null || removed_at === '' ? null : (typeof removed_at === 'string' ? removed_at : null)

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { id, updated: true },
        { status: 200 }
      )
    }

    const { error: updateError } = await supabaseAdmin
      .from('contact_submissions')
      .update(updatePayload)
      .eq('id', id)

    if (updateError) {
      console.error('Error updating lead:', updateError)
      return NextResponse.json(
        { error: 'Failed to update lead' },
        { status: 500 }
      )
    }

    const onlyDncOrRemoved = Object.keys(updatePayload).every((k) => k === 'do_not_contact' || k === 'removed_at')
    const shouldReRunEnrichment = !onlyDncOrRemoved && re_run_enrichment !== false
    if (shouldReRunEnrichment) {
      const finalName = (typeof name === 'string' ? name.trim() : null) ?? existing.name
      const finalEmail = (typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null) ?? existing.email ?? ''
      const finalCompany = (typeof company === 'string' ? company.trim() : null) ?? existing.company
      const finalCompanyDomain = (typeof company_domain === 'string' ? company_domain.trim() : null) ?? existing.company_domain
      const finalIndustry = (typeof industry === 'string' ? industry.trim() : null) ?? existing.industry
      const finalPhone = (typeof phone_number === 'string' ? phone_number.trim() : null) ?? existing.phone_number
      const finalLinkedin = normalizedLinkedinUrl ?? existing.linkedin_url

      triggerLeadQualificationWebhook({
        submissionId: String(id),
        submittedAt: new Date().toISOString(),
        name: finalName ?? '',
        email: finalEmail,
        company: finalCompany ?? undefined,
        companyDomain: finalCompanyDomain ?? undefined,
        industry: finalIndustry ?? undefined,
        phone: finalPhone ?? undefined,
        linkedinUrl: finalLinkedin ?? undefined,
        message: displayMessage,
        source: 'manual_entry',
      }).catch((err) => {
        console.error('Lead qualification webhook failed:', err)
      })
    }

    return NextResponse.json(
      { id, updated: true },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error in PATCH /api/admin/outreach/leads/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
