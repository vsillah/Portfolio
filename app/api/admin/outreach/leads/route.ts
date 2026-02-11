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
 * POST /api/admin/outreach/leads
 * Create or update a single lead (manual entry by salesperson).
 * Session auth only; does not use ingest API or N8N_INGEST_SECRET.
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
      employee_count,
      quick_wins,
      rep_pain_points,
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
      employee_count?: string
      quick_wins?: string
      rep_pain_points?: string
    }

    const leadSource = leadSourceFromInputType(input_type)
    const message = bodyMessage ?? notes ?? ''

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    if (email && typeof email === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: 'Invalid email address' },
          { status: 400 }
        )
      }
    }

    const normalizedLinkedinUrl = normalizeUrl(linkedin_url)
    const inputTypeLabel = input_type || 'unknown'
    const displayMessage = message.trim()
      ? message.trim()
      : `Imported manually (${inputTypeLabel})`

    let existingId: number | null = null

    if (email && email.trim()) {
      const { data } = await supabaseAdmin
        .from('contact_submissions')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .limit(1)
        .single()
      if (data) existingId = data.id
    }

    if (!existingId && linkedin_username && linkedin_username.trim()) {
      const { data } = await supabaseAdmin
        .from('contact_submissions')
        .select('id')
        .eq('linkedin_username', linkedin_username.trim())
        .limit(1)
        .single()
      if (data) existingId = data.id
    }

    if (!existingId && normalizedLinkedinUrl) {
      const { data } = await supabaseAdmin
        .from('contact_submissions')
        .select('id')
        .eq('linkedin_url', normalizedLinkedinUrl)
        .limit(1)
        .single()
      if (data) existingId = data.id
    }

    if (existingId) {
      const updatePayload: Record<string, unknown> = {
        name: name.trim(),
        company: company?.trim() || null,
        company_domain: company_domain?.trim() || null,
        job_title: job_title?.trim() || null,
        industry: industry?.trim() || null,
        location: location?.trim() || null,
        phone_number: phone_number?.trim() || null,
        linkedin_url: normalizedLinkedinUrl,
        linkedin_username: linkedin_username?.trim() || null,
        lead_source: leadSource,
        warm_source_detail: input_type ? `Manual entry: ${input_type}` : null,
        message: displayMessage,
        employee_count: employee_count?.trim() || null,
        quick_wins: quick_wins?.trim() || null,
        rep_pain_points: rep_pain_points?.trim() || null,
      }
      if (email !== undefined) updatePayload.email = email?.trim()?.toLowerCase() || null

      const { error: updateError } = await supabaseAdmin
        .from('contact_submissions')
        .update(updatePayload)
        .eq('id', existingId)

      if (updateError) {
        console.error('Error updating lead:', updateError)
        return NextResponse.json(
          { error: 'Failed to update lead' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { id: existingId, updated: true },
        { status: 200 }
      )
    }

    const insertPayload = {
      name: name.trim(),
      email: email?.trim()?.toLowerCase() || null,
      company: company?.trim() || null,
      company_domain: company_domain?.trim() || null,
      job_title: job_title?.trim() || null,
      industry: industry?.trim() || null,
      location: location?.trim() || null,
      phone_number: phone_number?.trim() || null,
      lead_source: leadSource,
      outreach_status: 'not_contacted',
      relationship_strength: 'weak',
      linkedin_url: normalizedLinkedinUrl,
      linkedin_username: linkedin_username?.trim() || null,
      warm_source_detail: input_type ? `Manual entry: ${input_type}` : null,
      message: displayMessage,
      employee_count: employee_count?.trim() || null,
      quick_wins: quick_wins?.trim() || null,
      rep_pain_points: rep_pain_points?.trim() || null,
    }

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('contact_submissions')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError) {
      console.error('Error inserting lead:', insertError)
      return NextResponse.json(
        { error: 'Failed to create lead' },
        { status: 500 }
      )
    }

    const newId = inserted.id as number

    triggerLeadQualificationWebhook({
      submissionId: String(newId),
      submittedAt: new Date().toISOString(),
      name: name.trim(),
      email: email?.trim() || '',
      company: company?.trim() || undefined,
      companyDomain: company_domain?.trim() || undefined,
      industry: industry?.trim() || undefined,
      phone: phone_number?.trim() || undefined,
      linkedinUrl: normalizedLinkedinUrl || undefined,
      message: displayMessage,
      source: 'manual_entry',
    }).catch((err) => {
      console.error('Lead qualification webhook failed:', err)
    })

    return NextResponse.json(
      { id: newId, created: true },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/leads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/outreach/leads
 * Fetch all leads with filtering, search, and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') || 'all' // 'all' | 'warm' | 'cold'
    const status = searchParams.get('status') // 'new' | 'contacted' | 'replied' | 'booked' | 'opted_out'
    const source = searchParams.get('source') // specific source like 'warm_facebook'
    const search = searchParams.get('search') // text search
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build the query
    let query = supabaseAdmin
      .from('contact_submissions')
      .select(`
        id,
        name,
        email,
        company,
        company_domain,
        job_title,
        industry,
        phone_number,
        lead_source,
        lead_score,
        outreach_status,
        qualification_status,
        created_at,
        linkedin_url,
        ai_readiness_score,
        competitive_pressure_score,
        quick_wins,
        message,
        full_report,
        rep_pain_points,
        last_vep_triggered_at,
        last_vep_status
      `, { count: 'exact' })

    // Filter by temperature (warm/cold)
    if (filter === 'warm') {
      query = query.like('lead_source', 'warm_%')
    } else if (filter === 'cold') {
      query = query.like('lead_source', 'cold_%')
    } else {
      // All leads - both warm and cold
      query = query.or('lead_source.like.warm_%,lead_source.like.cold_%')
    }

    // Filter by specific source (supports partial matching)
    if (source && source !== 'all') {
      // If source doesn't end with a specific sub-type, use pattern matching
      // e.g., "warm_facebook" matches "warm_facebook_friends", "warm_facebook_engagement", etc.
      if (source.match(/^(warm|cold)_\w+$/)) {
        query = query.like('lead_source', `${source}%`)
      } else {
        query = query.eq('lead_source', source)
      }
    }

    // Filter by outreach status
    if (status && status !== 'all') {
      query = query.eq('outreach_status', status)
    }

    // Text search
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`)
    }

    // Pagination and ordering
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: contacts, error, count } = await query

    if (error) {
      console.error('Error fetching leads:', error)
      throw error
    }

    const contactIds = (contacts || []).map((c: { id: number }) => c.id)
    if (contactIds.length === 0) {
      return NextResponse.json({
        leads: [],
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
      })
    }

    // Batch: evidence count per contact_submission_id
    const { data: evidenceRows } = await supabaseAdmin
      .from('pain_point_evidence')
      .select('contact_submission_id')
      .in('contact_submission_id', contactIds)

    const evidenceCountByContact: Record<number, number> = {}
    for (const row of evidenceRows || []) {
      const id = row.contact_submission_id as number
      if (id != null) {
        evidenceCountByContact[id] = (evidenceCountByContact[id] || 0) + 1
      }
    }

    // Batch: completed diagnostic per contact
    const { data: completedAudits } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('contact_submission_id')
      .in('contact_submission_id', contactIds)
      .eq('status', 'completed')

    const hasCompletedDiagnostic = new Set(
      (completedAudits || []).map((a: { contact_submission_id: number }) => a.contact_submission_id)
    )

    // Batch: sales sessions per contact (for "View in Sales" link and has_sales_conversation)
    const { data: sessionsRows } = await supabaseAdmin
      .from('sales_sessions')
      .select('id, contact_submission_id, created_at')
      .in('contact_submission_id', contactIds)
      .order('created_at', { ascending: false })

    const sessionsByContact: Record<number, { id: string; created_at: string }[]> = {}
    for (const row of sessionsRows || []) {
      const cid = row.contact_submission_id as number
      if (cid == null) continue
      if (!sessionsByContact[cid]) sessionsByContact[cid] = []
      sessionsByContact[cid].push({ id: row.id, created_at: row.created_at })
    }

    // For each lead, get aggregated message data (outreach_queue still per-lead)
    const leadsWithMetadata = await Promise.all(
      (contacts || []).map(async (contact: {
        id: number
        name: string
        email: string
        company: string | null
        company_domain: string | null
        job_title: string | null
        industry: string | null
        phone_number: string | null
        lead_source: string
        lead_score: number | null
        outreach_status: string
        qualification_status: string | null
        created_at: string
        linkedin_url: string | null
        ai_readiness_score: number | null
        competitive_pressure_score: number | null
        quick_wins: string | null
        message: string | null
        full_report: string | null
        rep_pain_points: string | null
        last_vep_triggered_at: string | null
        last_vep_status: string | null
      }) => {
        const { data: messages } = await supabaseAdmin
          .from('outreach_queue')
          .select('id, status')
          .eq('contact_submission_id', contact.id)

        const messages_count = messages?.length || 0
        const messages_sent = messages?.filter((m: { id: string; status: string }) => m.status === 'sent').length || 0
        const has_reply = messages?.some((m: { id: string; status: string }) => m.status === 'replied') || false

        const { data: audits } = await supabaseAdmin
          .from('diagnostic_audits')
          .select('id')
          .eq('contact_submission_id', contact.id)
          .limit(1)

        const leadSessions = sessionsByContact[contact.id] || []
        const has_sales_conversation = (audits?.length || 0) > 0 || leadSessions.length > 0
        const latest_session_id = leadSessions.length > 0 ? leadSessions[0].id : null
        const session_count = leadSessions.length
        const hasText =
          (contact.message?.trim()?.length ?? 0) > 0 ||
          (contact.quick_wins?.trim()?.length ?? 0) > 0 ||
          (contact.full_report?.trim()?.length ?? 0) > 0 ||
          (contact.rep_pain_points?.trim()?.length ?? 0) > 0
        const has_extractable_text = hasText || hasCompletedDiagnostic.has(contact.id)

        return {
          ...contact,
          messages_count,
          messages_sent,
          has_reply,
          has_sales_conversation,
          latest_session_id,
          session_count,
          evidence_count: evidenceCountByContact[contact.id] ?? 0,
          last_vep_triggered_at: contact.last_vep_triggered_at ?? null,
          last_vep_status: contact.last_vep_status ?? null,
          has_extractable_text,
        }
      })
    )

    return NextResponse.json({
      leads: leadsWithMetadata,
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/leads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
