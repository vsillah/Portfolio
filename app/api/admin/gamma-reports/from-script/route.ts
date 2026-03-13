/**
 * POST /api/admin/gamma-reports/from-script
 * Create a Gamma one-pager from script text (e.g. from Ideas Queue or Drive queue).
 * Body: { scriptText: string, title?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { generateGamma, waitForGeneration } from '@/lib/gamma-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({}))
    const scriptText = (body.scriptText as string)?.trim()
    if (!scriptText) {
      return NextResponse.json({ error: 'scriptText is required' }, { status: 400 })
    }

    const title =
      (body.title as string)?.trim() ||
      `One-pager from script (${new Date().toLocaleDateString()})`

    const options = {
      format: 'presentation' as const,
      textMode: 'condense' as const,
      numCards: 8,
      exportAs: 'pdf' as const,
      textOptions: {
        amount: 'brief' as const,
        tone: 'professional',
        language: 'en',
      },
      imageOptions: { source: 'noImages' as const },
      sharingOptions: { externalAccess: 'view' as const },
    }

    const { data: row, error: insertErr } = await supabaseAdmin
      .from('gamma_reports')
      .insert({
        report_type: 'audit_summary',
        title,
        input_text: scriptText,
        external_inputs: {},
        gamma_options: options,
        status: 'generating',
        created_by: auth.user?.id,
      })
      .select('id')
      .single()

    if (insertErr || !row) {
      console.error('[Gamma from-script] Insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create report record' }, { status: 500 })
    }

    const reportId = row.id

    let gammaResult
    try {
      const { generationId } = await generateGamma(scriptText, options)
      await supabaseAdmin
        .from('gamma_reports')
        .update({ gamma_generation_id: generationId })
        .eq('id', reportId)

      gammaResult = await waitForGeneration(generationId)
    } catch (gammaErr) {
      const errMsg = gammaErr instanceof Error ? gammaErr.message : 'Gamma API error'
      await supabaseAdmin
        .from('gamma_reports')
        .update({ status: 'failed', error_message: errMsg })
        .eq('id', reportId)
      return NextResponse.json({ error: 'Gamma generation failed', details: errMsg }, { status: 502 })
    }

    if (gammaResult.status === 'failed') {
      await supabaseAdmin
        .from('gamma_reports')
        .update({
          status: 'failed',
          error_message: gammaResult.error?.message || 'Generation failed',
        })
        .eq('id', reportId)
      return NextResponse.json(
        { error: 'Gamma generation failed', details: gammaResult.error?.message },
        { status: 502 }
      )
    }

    await supabaseAdmin
      .from('gamma_reports')
      .update({
        status: 'completed',
        gamma_url: gammaResult.gammaUrl,
        gamma_generation_id: gammaResult.generationId,
      })
      .eq('id', reportId)

    return NextResponse.json({
      reportId,
      title,
      gammaUrl: gammaResult.gammaUrl,
      generationId: gammaResult.generationId,
      status: 'completed',
      credits: gammaResult.credits,
    })
  } catch (error) {
    console.error('[Gamma from-script] Error:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
