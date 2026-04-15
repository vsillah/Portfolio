/**
 * POST /api/admin/contacts/[id]/compose-delivery
 * Generate a delivery email draft using the system prompt + LLM.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DeliveryDraftError, generateDeliveryDraft, type AssetRef } from '@/lib/delivery-email'
import type { EmailTemplateKey } from '@/lib/constants/prompt-keys'

export const dynamic = 'force-dynamic'

/** Public site origin for dashboard links (avoids `https://undefined` when env precedence is wrong). */
function composeDeliveryServerOrigin(): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  if (base) return base.replace(/\/$/, '')
  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel}`
  return 'https://amadutown.com'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const resolved = await Promise.resolve(params)
  const contactId = parseInt(resolved.id, 10)
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
        const origin = composeDeliveryServerOrigin()
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
    if (err instanceof DeliveryDraftError) {
      if (err.code === 'openai_not_configured') {
        return NextResponse.json(
          {
            error:
              'Email drafts require an OpenAI API key. Add OPENAI_API_KEY to the server environment (for example Vercel → Project → Settings → Environment Variables) and redeploy.',
          },
          { status: 503 }
        )
      }
      if (err.code === 'openai_upstream') {
        return NextResponse.json(
          {
            error:
              'The AI service did not complete this request. Check server logs for details, verify your OpenAI billing and model access, then try again.',
          },
          { status: 502 }
        )
      }
      if (err.code === 'invalid_response') {
        return NextResponse.json(
          { error: 'The AI returned an unexpected response. Try generating again or adjust the template in System Prompts.' },
          { status: 502 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to generate email draft. Please try again.' },
      { status: 500 }
    )
  }
}
