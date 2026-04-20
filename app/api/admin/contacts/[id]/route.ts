/**
 * GET /api/admin/contacts/[id]
 * Aggregates all data for a single contact: info, assets, deliveries, timeline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { suggestEmailTemplate } from '@/lib/delivery-email'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
  }

  const { data: contact, error: contactErr } = await supabaseAdmin
    .from('contact_submissions')
    .select('id, name, email, company, industry, lead_source, lead_score, outreach_status, created_at, employee_count')
    .eq('id', contactId)
    .single()

  if (contactErr) {
    console.error('[Contact detail] Supabase error:', contactErr.message, contactErr.code, contactErr.details)
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }
  if (!contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  const [
    gammaRes,
    videoRes,
    valueRes,
    auditRes,
    outreachRes,
    deliveryRes,
    dashboardRes,
    salesRes,
    communicationsRes,
    meetingRes,
    projectRes,
  ] = await Promise.all([
    supabaseAdmin
      .from('gamma_reports')
      .select('id, report_type, title, gamma_url, status, error_message, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('video_generation_jobs')
      .select('id, script_source, heygen_status, video_url, thumbnail_url, channel, aspect_ratio, gamma_report_id, created_at, deleted_at')
      .eq('contact_submission_id', contactId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('value_reports')
      .select('id, title, report_type, industry, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('diagnostic_audits')
      .select('id, status, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false }),

    supabaseAdmin
      .from('outreach_queue')
      .select('id, channel, subject, status, sequence_step, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false })
      .limit(10),

    supabaseAdmin
      .from('contact_deliveries')
      .select('id, subject, recipient_email, asset_ids, dashboard_token, sent_at, status, error_message')
      .eq('contact_submission_id', contactId)
      .order('sent_at', { ascending: false }),

    supabaseAdmin
      .from('client_dashboard_access')
      .select('id, access_token, client_email, is_active, diagnostic_audit_id, client_project_id, created_at')
      .eq('client_email', contact.email)
      .eq('is_active', true)
      .limit(1),

    supabaseAdmin
      .from('sales_sessions')
      .select('id, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false })
      .limit(5),

    supabaseAdmin
      .from('contact_communications')
      .select('id, channel, direction, message_type, subject, body, source_system, source_id, prompt_key, status, sent_at, sent_by, metadata, created_at')
      .eq('contact_submission_id', contactId)
      .order('created_at', { ascending: false })
      .limit(50),

    supabaseAdmin
      .from('meeting_records')
      .select('id, meeting_date, meeting_type')
      .eq('contact_submission_id', contactId)
      .order('meeting_date', { ascending: false })
      .limit(20),

    supabaseAdmin
      .from('client_projects')
      .select('id, project_name, project_status')
      .eq('contact_submission_id', contactId)
      .limit(5),
  ])

  // Build timeline from all events
  const timeline: Array<{ type: string; date: string; title: string; detail?: string; id?: string }> = []

  timeline.push({ type: 'contact', date: contact.created_at, title: 'Contact created', detail: `via ${contact.lead_source || 'unknown'}` })

  for (const a of auditRes.data ?? []) {
    timeline.push({ type: 'audit', date: a.created_at, title: `Diagnostic audit ${a.status}`, id: String(a.id) })
  }
  for (const g of gammaRes.data ?? []) {
    timeline.push({ type: 'gamma', date: g.created_at, title: `Gamma deck: ${g.title || g.report_type}`, detail: g.status, id: g.id })
  }
  for (const v of videoRes.data ?? []) {
    timeline.push({ type: 'video', date: v.created_at, title: `Video (${v.channel || 'youtube'})`, detail: v.heygen_status || 'unknown', id: v.id })
  }
  for (const vr of valueRes.data ?? []) {
    timeline.push({ type: 'value_report', date: vr.created_at, title: `Value report: ${vr.title || vr.report_type}`, id: vr.id })
  }
  for (const o of outreachRes.data ?? []) {
    timeline.push({ type: 'outreach', date: o.created_at, title: `Outreach (${o.channel}): ${o.subject || 'No subject'}`, detail: o.status, id: o.id })
  }
  for (const d of deliveryRes.data ?? []) {
    timeline.push({ type: 'delivery', date: d.sent_at, title: `Delivery email: ${d.subject}`, detail: d.status, id: d.id })
  }
  for (const s of salesRes.data ?? []) {
    timeline.push({ type: 'sales', date: s.created_at, title: `Sales session`, id: s.id })
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const pageData = {
    gammaReports: gammaRes.data ?? [],
    videos: videoRes.data ?? [],
    valueReports: valueRes.data ?? [],
    audits: auditRes.data ?? [],
    deliveries: deliveryRes.data ?? [],
    salesSessions: salesRes.data ?? [],
    meetingRecords: meetingRes.data ?? [],
    clientProjects: projectRes.data ?? [],
  }

  const suggestedTemplate = suggestEmailTemplate(pageData)

  return NextResponse.json({
    contact,
    ...pageData,
    outreach: outreachRes.data ?? [],
    communications: communicationsRes.data ?? [],
    dashboardAccess: dashboardRes.data?.[0] ?? null,
    timeline,
    suggestedTemplate,
  })
}
