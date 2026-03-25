/**
 * POST /api/admin/contacts/[id]/send-delivery
 * Send a delivery email and log it.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDeliveryEmail, type AssetRef } from '@/lib/delivery-email'

export const dynamic = 'force-dynamic'

export async function POST(
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

  const userId = auth.user?.id
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const subject = (body.subject as string)?.trim()
  const emailBody = (body.body as string)?.trim()
  const recipientEmail = (body.recipientEmail as string)?.trim()
  const assetIds = (body.assetIds ?? []) as AssetRef[]
  const includeDashboardLink = body.includeDashboardLink !== false

  if (!subject || !emailBody || !recipientEmail) {
    return NextResponse.json(
      { error: 'subject, body, and recipientEmail are required' },
      { status: 400 }
    )
  }

  let dashboardToken: string | null = null

  if (includeDashboardLink) {
    const { data: contact } = await supabaseAdmin
      .from('contact_submissions')
      .select('email')
      .eq('id', contactId)
      .single()

    if (contact?.email) {
      const { data: existing } = await supabaseAdmin
        .from('client_dashboard_access')
        .select('access_token')
        .eq('client_email', contact.email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (existing?.access_token) {
        dashboardToken = existing.access_token
      } else {
        // Auto-provision: find a diagnostic audit for this contact to anchor the access
        const { data: audit } = await supabaseAdmin
          .from('diagnostic_audits')
          .select('id')
          .eq('contact_submission_id', contactId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (audit?.id) {
          const { data: newAccess } = await supabaseAdmin
            .from('client_dashboard_access')
            .insert({
              client_email: contact.email,
              diagnostic_audit_id: audit.id,
            })
            .select('access_token')
            .single()

          dashboardToken = newAccess?.access_token ?? null
        }
      }
    }
  }

  const result = await sendDeliveryEmail({
    contactId,
    recipientEmail,
    subject,
    body: emailBody,
    assetIds,
    dashboardToken,
    sentBy: userId,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Send failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    deliveryId: result.deliveryId,
    dashboardToken,
  })
}
