import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerLeadQualificationWebhook } from '@/lib/n8n'
import { leadSourceFromInputType } from '@/lib/constants/lead-source'
import { partitionN8nOutreachReconcile } from '@/lib/n8n-outreach-contact-status'
import { partitionVepReconcile } from '@/lib/vep-contact-status'
import { generateOutreachDraftInApp } from '@/lib/outreach-queue-generator'
import { notifyOutreachDraftReady } from '@/lib/slack-outreach-notification'

export const dynamic = 'force-dynamic'
/**
 * In-app email draft generation runs synchronously when `generate_outreach`
 * is true (or for `input_type === 'meeting'`). Saraev-style prompts + RAG can
 * push the LLM past the default 10s budget; bump to 60s like the
 * `/leads/[id]/generate` endpoint.
 */
export const maxDuration = 60

/**
 * Kick off in-app outreach generation for a freshly-created/updated lead.
 *
 * Replaces the prior `triggerOutreachGeneration` n8n webhook (WF-CLG-002):
 *  - Loads `system_prompts.email_cold_outreach` with full RAG + chat context
 *  - Inserts the draft into `outreach_queue`
 *  - Pings Slack via `SLACK_OUTREACH_DRAFT_WEBHOOK_URL` (best effort)
 *
 * Awaited so the draft exists by the time the API responds and the admin UI
 * sees it on the next refetch. Errors are caught and logged — they must not
 * block the lead create/update response.
 */
async function generateInAppDraftForNewLead(params: {
  contactId: number
  contactName: string | null
  contactEmail: string | null
  meetingSummary?: string | null
}): Promise<void> {
  try {
    const result = await generateOutreachDraftInApp({
      contactId: params.contactId,
      sequenceStep: 1,
      meetingSummary: params.meetingSummary ?? undefined,
    })
    if (result.outcome === 'created') {
      notifyOutreachDraftReady({
        contactId: params.contactId,
        contactName: params.contactName,
        contactEmail: params.contactEmail,
        channel: 'email',
        templateKey: 'email_cold_outreach',
        queueId: result.id,
      }).catch((err) => {
        console.warn('[leads] notifyOutreachDraftReady failed', err)
      })
    }
  } catch (err) {
    console.error('[leads] in-app outreach generation failed:', err)
  }
}

function normalizeUrl(url: string | undefined): string | null {
  if (!url || !url.trim()) return null
  const trimmed = url.trim()
  if (trimmed.match(/^https?:\/\//i)) return trimmed
  return `https://${trimmed}`
}

async function linkMeetingToLead(meetingRecordId: string, contactSubmissionId: number) {
  const { error } = await supabaseAdmin
    .from('meeting_records')
    .update({ contact_submission_id: contactSubmissionId })
    .eq('id', meetingRecordId)
  if (error) {
    console.error('Failed to link meeting to lead:', error)
  }
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
      meeting_record_id,
      meeting_summary,
      meeting_pain_points,
      generate_outreach,
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
      meeting_record_id?: string
      meeting_summary?: string
      meeting_pain_points?: string
      generate_outreach?: boolean
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

      if (meeting_record_id) {
        await linkMeetingToLead(meeting_record_id, existingId)
      }

      const shouldGenerateOutreachOnUpdate = generate_outreach || input_type === 'meeting'
      if (shouldGenerateOutreachOnUpdate) {
        await generateInAppDraftForNewLead({
          contactId: existingId,
          contactName: name?.trim() || null,
          contactEmail: email?.trim()?.toLowerCase() || null,
          meetingSummary: meeting_summary || null,
        })
      }

      return NextResponse.json(
        { id: existingId, updated: true, outreach_queued: shouldGenerateOutreachOnUpdate },
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

    if (meeting_record_id) {
      await linkMeetingToLead(meeting_record_id, newId)
    }

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
      source: input_type === 'meeting' ? 'meeting' : 'manual_entry',
    }).catch((err) => {
      console.error('Lead qualification webhook failed:', err)
    })

    const shouldGenerateOutreach = generate_outreach || input_type === 'meeting'
    if (shouldGenerateOutreach) {
      await generateInAppDraftForNewLead({
        contactId: newId,
        contactName: name.trim(),
        contactEmail: email?.trim()?.toLowerCase() || null,
        meetingSummary: meeting_summary || null,
      })
    }

    return NextResponse.json(
      { id: newId, created: true, outreach_queued: shouldGenerateOutreach },
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
    const visibility = searchParams.get('visibility') || 'active' // 'active' | 'do_not_contact' | 'removed' | 'all'
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
        last_vep_status,
        last_n8n_outreach_triggered_at,
        last_n8n_outreach_status,
        last_n8n_outreach_template_key,
        do_not_contact,
        removed_at,
        website_tech_stack,
        website_tech_stack_fetched_at
      `, { count: 'exact' })

    // Visibility: active (default) = show only contactable leads; do_not_contact | removed | all
    if (visibility === 'active') {
      query = query.eq('do_not_contact', false).is('removed_at', null)
    } else if (visibility === 'do_not_contact') {
      query = query.eq('do_not_contact', true).is('removed_at', null)
    } else if (visibility === 'removed') {
      query = query.not('removed_at', 'is', null)
    }
    // visibility === 'all': no filter on do_not_contact/removed_at

    // Filter by temperature (warm/cold). "all" = no lead_source filter so every lead is shown.
    if (filter === 'warm') {
      query = query.like('lead_source', 'warm_%')
    } else if (filter === 'cold') {
      query = query.like('lead_source', 'cold_%')
    }
    // else filter === 'all': do not filter by lead_source (include website_form, other, etc.)

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

    // Batch: deduped evidence count per contact_submission_id.
    // Mirrors the dedupe policy in GET /api/admin/value-evidence/evidence:
    // one row per pain_point_category_id (classifier re-runs stack duplicate
    // rows, so the raw count overstates how many distinct pain points exist).
    const { data: evidenceRows } = await supabaseAdmin
      .from('pain_point_evidence')
      .select('contact_submission_id, pain_point_category_id')
      .in('contact_submission_id', contactIds)

    const evidenceCategoriesByContact: Record<number, Set<string>> = {}
    for (const row of evidenceRows || []) {
      const id = row.contact_submission_id as number
      if (id == null) continue
      if (!evidenceCategoriesByContact[id]) evidenceCategoriesByContact[id] = new Set<string>()
      const catKey =
        (row.pain_point_category_id as string | null) ?? `__no_cat__:${row.contact_submission_id}`
      evidenceCategoriesByContact[id].add(catKey)
    }
    const evidenceCountByContact: Record<number, number> = {}
    for (const [id, cats] of Object.entries(evidenceCategoriesByContact)) {
      evidenceCountByContact[Number(id)] = cats.size
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

    // Batch: all outreach_queue rows for this page of contacts (avoids N+1 per lead).
    const { data: allQueueRows } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, contact_submission_id, status, subject, created_at, channel')
      .in('contact_submission_id', contactIds)

    type QueueRow = {
      id: string
      contact_submission_id: number
      status: string
      subject: string | null
      created_at: string
      channel: string
    }
    const messagesByContact: Record<number, QueueRow[]> = {}
    for (const row of (allQueueRows || []) as QueueRow[]) {
      const cid = row.contact_submission_id
      if (!messagesByContact[cid]) messagesByContact[cid] = []
      messagesByContact[cid].push(row)
    }
    for (const cid of contactIds) {
      const arr = messagesByContact[cid] || []
      arr.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }

    // Stuck n8n "pending" → success if an email row appeared; → failed if stale
    const { toSuccess: n8nReconcileSuccess, toFail: n8nReconcileFail } = partitionN8nOutreachReconcile(
      (contacts || []) as Array<{
        id: number
        last_n8n_outreach_status: string | null
        last_n8n_outreach_triggered_at: string | null
      }>,
      messagesByContact,
    )
    const n8nSuccessSet = new Set(n8nReconcileSuccess)
    const n8nFailSet = new Set(n8nReconcileFail)
    if (n8nReconcileSuccess.length > 0) {
      const { error: n8nOkErr } = await supabaseAdmin
        .from('contact_submissions')
        .update({ last_n8n_outreach_status: 'success' })
        .in('id', n8nReconcileSuccess)
      if (n8nOkErr) {
        console.warn('n8n reconcile success batch:', n8nOkErr.message)
      }
    }
    if (n8nReconcileFail.length > 0) {
      const { error: n8nFailErr } = await supabaseAdmin
        .from('contact_submissions')
        .update({ last_n8n_outreach_status: 'failed' })
        .in('id', n8nReconcileFail)
      if (n8nFailErr) {
        console.warn('n8n reconcile fail batch:', n8nFailErr.message)
      }
    }

    // VEP-001 pending sweep: flip leads that never got a workflow-complete
    // callback (pre-hardening crashes, mis-routed webhooks, etc.) to `failed`
    // after STALE_VEP_PENDING_MS so the UI exposes "Retry" instead of an
    // indefinite "Stalled — retry" chip.
    const { toFail: vepReconcileFail } = partitionVepReconcile(
      (contacts || []) as Array<{
        id: number
        last_vep_status: string | null
        last_vep_triggered_at: string | null
      }>,
    )
    const vepFailSet = new Set(vepReconcileFail)
    if (vepReconcileFail.length > 0) {
      const { error: vepFailErr } = await supabaseAdmin
        .from('contact_submissions')
        .update({ last_vep_status: 'failed' })
        .in('id', vepReconcileFail)
        .eq('last_vep_status', 'pending')
      if (vepFailErr) {
        console.warn('VEP reconcile fail batch:', vepFailErr.message)
      }
    }

    // Batch: at least one diagnostic per contact (replaces N per-lead .limit(1) queries)
    const { data: allAuditsForLeads } = await supabaseAdmin
      .from('diagnostic_audits')
      .select('id, contact_submission_id')
      .in('contact_submission_id', contactIds)
    const contactWithAudit = new Set(
      (allAuditsForLeads || []).map((a: { contact_submission_id: number }) => a.contact_submission_id),
    )

    const RECENT_EMAIL_DRAFTS = 5

    // Batch: map outreach_queue.id → email_messages.id (for clickable deep links
    // to /admin/email-messages/[id]). Scoped to the email rows we'll surface.
    const emailQueueIdsForLookup = Array.from(
      new Set(
        ((allQueueRows || []) as QueueRow[])
          .filter((r) => r.channel === 'email')
          .map((r) => r.id),
      ),
    )
    const emailMessageIdByQueueId: Record<string, string> = {}
    if (emailQueueIdsForLookup.length > 0) {
      const { data: emRows } = await supabaseAdmin
        .from('email_messages')
        .select('id, source_id')
        .eq('source_system', 'outreach_queue')
        .in('source_id', emailQueueIdsForLookup)
      for (const row of (emRows || []) as { id: string; source_id: string | null }[]) {
        if (row.source_id && !emailMessageIdByQueueId[row.source_id]) {
          emailMessageIdByQueueId[row.source_id] = row.id
        }
      }
    }

    const leadsWithMetadata = (contacts || []).map(
      (contact: {
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
        last_n8n_outreach_triggered_at: string | null
        last_n8n_outreach_status: string | null
        last_n8n_outreach_template_key: string | null
      }) => {
        const messages = messagesByContact[contact.id] || []
        const messages_count = messages.length
        const messages_sent = messages.filter((m) => m.status === 'sent').length
        const has_reply = messages.some((m) => m.status === 'replied')
        const emailChrono = messages.filter((m) => m.channel === 'email')
        const recent_email_drafts = emailChrono
          .slice(0, RECENT_EMAIL_DRAFTS)
          .map((m) => ({
            id: m.id,
            subject: m.subject,
            status: m.status,
            created_at: m.created_at,
            email_message_id: emailMessageIdByQueueId[m.id] ?? null,
          }))

        const leadSessions = sessionsByContact[contact.id] || []
        const has_sales_conversation = contactWithAudit.has(contact.id) || leadSessions.length > 0
        const latest_session_id = leadSessions.length > 0 ? leadSessions[0].id : null
        const session_count = leadSessions.length
        const hasText =
          (contact.message?.trim()?.length ?? 0) > 0 ||
          (contact.quick_wins?.trim()?.length ?? 0) > 0 ||
          (contact.full_report?.trim()?.length ?? 0) > 0 ||
          (contact.rep_pain_points?.trim()?.length ?? 0) > 0
        const has_extractable_text = hasText || hasCompletedDiagnostic.has(contact.id)

        let lastN8nStatus = contact.last_n8n_outreach_status ?? null
        if (n8nSuccessSet.has(contact.id)) lastN8nStatus = 'success'
        else if (n8nFailSet.has(contact.id)) lastN8nStatus = 'failed'

        let lastVepStatus = contact.last_vep_status ?? null
        if (vepFailSet.has(contact.id)) lastVepStatus = 'failed'

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
          last_vep_status: lastVepStatus,
          last_n8n_outreach_triggered_at: contact.last_n8n_outreach_triggered_at ?? null,
          last_n8n_outreach_status: lastN8nStatus,
          last_n8n_outreach_template_key: contact.last_n8n_outreach_template_key ?? null,
          has_extractable_text,
          recent_email_drafts,
        }
      },
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
