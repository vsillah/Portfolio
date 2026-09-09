import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

import { warmCopyBlocker, warmCopyEvidenceBlocker } from '@/lib/warm-outreach-copy-quality'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/outreach
 * List outreach queue items with lead data for admin review
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
    const status = searchParams.get('status') || 'draft'
    const channel = searchParams.get('channel')
    const search = searchParams.get('search')
    const contactParam = searchParams.get('contact') // Filter by specific contact
    const contactId = contactParam ? parseInt(contactParam, 10) : null
    if (contactParam != null && contactParam !== '' && (contactId === null || Number.isNaN(contactId) || contactId < 1)) {
      return NextResponse.json(
        { error: 'contact must be a positive integer' },
        { status: 400 }
      )
    }
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Fetch outreach queue items with contact data
    let query = supabaseAdmin
      .from('outreach_queue')
      .select(
        `
        id,
        contact_submission_id,
        channel,
        subject,
        body,
        sequence_step,
        status,
        thread_id,
        scheduled_send_at,
        sent_at,
        replied_at,
        reply_content,
        generation_model,
        generation_prompt_summary,
        approved_at,
        created_at,
        updated_at,
        contact_submissions (
          id,
          name,
          email,
          company,
          company_domain,
          job_title,
          industry,
          lead_score,
          qualification_status,
          lead_source,
          outreach_status,
          full_report,
          quick_wins,
          ai_readiness_score,
          competitive_pressure_score,
          linkedin_url
        )
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (channel && channel !== 'all') {
      query = query.eq('channel', channel)
    }

    if (contactId != null && contactId > 0) {
      query = query.eq('contact_submission_id', contactId)
    }

    if (search) {
      // Search by lead name, email, or company via a subquery approach
      // We'll filter in application layer since Supabase doesn't support
      // filtering on joined table fields in the same query easily
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching outreach queue:', error)
      return NextResponse.json(
        { error: 'Failed to fetch outreach queue' },
        { status: 500 }
      )
    }

    // Apply search filter in application layer if needed
    let filtered = data || []
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter((item: Record<string, unknown>) => {
        const contact = item.contact_submissions as Record<string, unknown> | null
        if (!contact) return false
        return (
          (contact.name as string || '').toLowerCase().includes(searchLower) ||
          (contact.email as string || '').toLowerCase().includes(searchLower) ||
          (contact.company as string || '').toLowerCase().includes(searchLower)
        )
      })
    }

    // Compute stats
    const { data: statsData } = await supabaseAdmin
      .from('outreach_queue')
      .select('status')

    const stats = {
      draft: 0,
      approved: 0,
      sent: 0,
      replied: 0,
      bounced: 0,
      cancelled: 0,
      rejected: 0,
      total: statsData?.length || 0,
    }

    for (const item of statsData || []) {
      const s = item.status as keyof typeof stats
      if (s in stats) stats[s]++
    }

    return NextResponse.json({
      items: filtered,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/admin/outreach
 * Bulk update outreach items (approve, reject, edit)
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
    const { action, ids, updates, expectedVersions } = await request.json()
    if (!['approve', 'reject', 'edit'].includes(action) || !Array.isArray(ids) || !ids.length ||
      ids.some((id: unknown) => typeof id !== 'string') || new Set(ids).size !== ids.length ||
      !expectedVersions || ids.some((id: string) => typeof expectedVersions[id] !== 'string')) {
      return NextResponse.json({ error: 'Action, unique ids, and the reviewed version of every item are required.' }, { status: 400 })
    }
    if (action === 'edit' && (ids.length !== 1 || !updates || typeof updates !== 'object' || Array.isArray(updates) ||
      ('body' in updates && typeof updates.body !== 'string') ||
      ('subject' in updates && typeof updates.subject !== 'string') ||
      (typeof updates.body !== 'string' && typeof updates.subject !== 'string'))) {
      return NextResponse.json({ error: 'Edit requires one item and copy changes.' }, { status: 400 })
    }
    const { data: rows, error: lookupError } = await supabaseAdmin.from('outreach_queue')
      .select('id, status, subject, body, generation_inputs, sent_at, updated_at').in('id', ids)
    if (lookupError) return NextResponse.json({ error: 'Could not load current review state' }, { status: 500 })
    if (!rows || rows.length !== ids.length) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    for (const row of rows) {
      if (!row.updated_at || expectedVersions[row.id] !== row.updated_at) {
        return NextResponse.json({ error: 'Draft changed since it was opened. Reload and review the current copy.', changedIds: [] }, { status: 409 })
      }
      const blocker = warmCopyEvidenceBlocker(row.generation_inputs)
      if (row.sent_at || !['draft', 'approved', 'rejected'].includes(row.status) || blocker ||
        (action !== 'edit' && row.status !== 'draft')) {
        return NextResponse.json({ error: blocker ?? 'This message cannot be reviewed in its current state.', changedIds: [] }, { status: 409 })
      }
      const quality = action === 'approve' ? warmCopyBlocker(row.body) : action === 'edit' && updates.body !== undefined ? warmCopyBlocker(updates.body) : null
      if (quality) return NextResponse.json({ error: quality, changedIds: [] }, { status: 409 })
      if (action === 'edit' && (typeof updates.body === 'string' ? updates.body : row.body) === row.body && (typeof updates.subject === 'string' ? updates.subject : row.subject) === row.subject) {
        return NextResponse.json({ error: 'Change the copy before returning it to review.', changedIds: [] }, { status: 409 })
      }
    }
    const changedIds: string[] = []
    const versions: Record<string, string> = {}
    const generationInputsById: Record<string, unknown> = {}
    for (const row of rows) {
      const now = new Date(Math.max(Date.now(), Date.parse(row.updated_at) + 1)).toISOString()
      let payload: Record<string, unknown> = { updated_at: now }
      if (action === 'approve') payload = { ...payload, status: 'approved', approved_by: auth.user.id, approved_at: now }
      if (action === 'reject') payload = { ...payload, status: 'rejected', approved_by: null, approved_at: null,
        generation_inputs: { ...row.generation_inputs, revision_feedback: typeof updates?.feedback === 'string' ? updates.feedback.trim().slice(0, 2000) : null } }
      if (action === 'edit') payload = { ...payload, status: 'draft', approved_by: null, approved_at: null,
        ...(typeof updates.subject === 'string' ? { subject: updates.subject } : {}),
        ...(typeof updates.body === 'string' ? { body: updates.body } : {}),
        generation_inputs: { ...row.generation_inputs,
          warm_gmail_copy_revision_history: [{ subject: row.subject, body: row.body, authorization: row.generation_inputs?.warm_gmail_send_authorization ?? null, approval_request: row.generation_inputs?.warm_gmail_send_slack_approval_request ?? null, revised_at: now }, ...(Array.isArray(row.generation_inputs?.warm_gmail_copy_revision_history) ? row.generation_inputs.warm_gmail_copy_revision_history : [])].slice(0, 25),
          warm_gmail_send_authorization: null,
          warm_gmail_send_slack_approval_request: null, copy_revision_at: now,
          copy_revision_requires_provider_reconciliation: Boolean(row.generation_inputs?.gmail_draft_creation) || row.generation_inputs?.copy_revision_requires_provider_reconciliation === true } }
      const { data: changed, error } = await supabaseAdmin.from('outreach_queue').update(payload)
        .eq('id', row.id).eq('status', row.status).eq('updated_at', expectedVersions[row.id]).select('id, updated_at')
      if (error || !changed?.length) {
        return NextResponse.json({ error: 'Review stopped because an item changed or could not be saved. Reload the remaining items.',
          changedIds, unchangedIds: ids.filter((id: string) => !changedIds.includes(id)), versions,
          message: `${changedIds.length} of ${ids.length} items updated.` }, { status: error ? 500 : 409 })
      }
      changedIds.push(row.id)
      versions[row.id] = changed[0].updated_at ?? now
      generationInputsById[row.id] = payload.generation_inputs ?? row.generation_inputs
    }
    return NextResponse.json({ action: action === 'edit' ? 'edited' : action === 'approve' ? 'approved' : 'rejected', changedIds, versions, generationInputsById,
      message: action === 'edit' ? 'Copy saved. Review required again.' : `${changedIds.length} item(s) ${action === 'approve' ? 'approved' : 'rejected'}.` })
  } catch (error) {
    console.error('Error in PATCH /api/admin/outreach:', error)
    return NextResponse.json({ error: 'Could not update outreach review.' }, { status: 500 })
  }
}
