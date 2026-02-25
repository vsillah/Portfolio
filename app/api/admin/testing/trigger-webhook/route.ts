import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { JOURNEY_SCRIPTS_BY_ID } from '@/lib/testing/journey-scripts'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const { scriptId } = body as { scriptId?: string }

    if (!scriptId) {
      return NextResponse.json({ error: 'scriptId is required' }, { status: 400 })
    }

    const script = JOURNEY_SCRIPTS_BY_ID[scriptId]
    if (!script) {
      return NextResponse.json({ error: 'Unknown script ID' }, { status: 404 })
    }

    if (script.type !== 'trigger_webhook') {
      return NextResponse.json(
        { error: `This script type (${script.type}) is not a webhook trigger.` },
        { status: 400 }
      )
    }

    if (!script.webhookPath && !script.webhookEnvVar) {
      return NextResponse.json(
        { error: 'This trigger has no webhook path configured (e.g. Stripe checkout is handled separately).' },
        { status: 400 }
      )
    }

    const n8nBase = process.env.N8N_BASE_URL || 'https://amadutown.app.n8n.cloud'
    let webhookUrl: string

    if (script.webhookEnvVar && process.env[script.webhookEnvVar]) {
      webhookUrl = process.env[script.webhookEnvVar]!
    } else if (script.webhookPath) {
      webhookUrl = `${n8nBase}/webhook/${script.webhookPath}`
    } else {
      return NextResponse.json({ error: 'No webhook URL could be resolved.' }, { status: 500 })
    }

    let payload: unknown = {}
    if (script.payloadPath) {
      try {
        const fullPath = join(process.cwd(), script.payloadPath)
        const raw = await readFile(fullPath, 'utf-8')
        payload = JSON.parse(raw)
      } catch (e) {
        console.error(`Failed to read payload file ${script.payloadPath}:`, e)
        return NextResponse.json(
          { error: `Payload file not found: ${script.payloadPath}` },
          { status: 500 }
        )
      }
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const status = res.status
    let responseBody: unknown
    try {
      responseBody = await res.json()
    } catch {
      responseBody = await res.text().catch(() => null)
    }

    return NextResponse.json({
      success: status >= 200 && status < 300,
      httpStatus: status,
      webhookUrl,
      scriptId: script.id,
      scriptLabel: script.label,
      response: responseBody,
    })
  } catch (err) {
    console.error('Trigger webhook error:', err)
    return NextResponse.json(
      { error: 'Something went wrong triggering the webhook.' },
      { status: 500 }
    )
  }
}
