/**
 * POST /api/admin/contacts/[id]/compose-delivery
 * Generate a delivery email draft using the system prompt + LLM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateDeliveryDraft, type AssetRef } from '@/lib/delivery-email'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

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

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const assetIds = (body.assetIds ?? []) as AssetRef[]
  const templateKey = (body.templateKey as EmailTemplateKey) || undefined
  const customNote = (body.customNote as string) ?? ''
  const includeDashboardLink = body.includeDashboardLink !== false

  let dashboardUrl: string | undefined
  if (includeDashboardLink) {
    const { data: contact } = await supabaseAdmin
      .from('contact_submissions')
      .select('email')
      .eq('id', contactId)
      .single()

    if (contact?.email) {
      const { data: access } = await supabaseAdmin
        .from('client_dashboard_access')
        .select('access_token')
        .eq('client_email', contact.email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle()

      if (access?.access_token) {
        const origin = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://amadutown.com'
        dashboardUrl = `${origin}/client/dashboard/${access.access_token}`
      }
    }
  }

  try {
    const draft = await generateDeliveryDraft({
      contactId,
      assetIds,
      templateKey,
      customNote: customNote || undefined,
      dashboardUrl,
    })

    return NextResponse.json(draft)
  } catch (err) {
    console.error('[Compose delivery] Error:', err)
    return NextResponse.json(
      { error: 'Failed to generate email draft. Please try again.' },
      { status: 500 }
    )
  }
}
