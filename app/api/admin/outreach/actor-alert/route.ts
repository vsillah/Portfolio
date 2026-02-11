import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/actor-alert
 *
 * Receives Apify actor health alerts from the n8n monitoring workflow.
 * Logs alerts to warm_lead_trigger_audit and could be extended to send
 * email/Slack notifications.
 *
 * Body: { alerts: [...] } — each item may use id/name (n8n) or actor/actorName; others: failedRuns, totalRuns, lastError, severity.
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate via N8N_INGEST_SECRET
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.N8N_INGEST_SECRET
    const token = authHeader?.replace('Bearer ', '')

    if (!expectedSecret || token !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { alerts } = body as {
      alerts?: Array<{
        actor: string
        actorName: string
        failedRuns: number
        totalRuns: number
        lastError: string
        severity: 'warning' | 'critical'
      }>
    }

    if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
      return NextResponse.json({ success: true, message: 'No alerts to process' })
    }

    const now = new Date().toISOString()

    // Normalize: n8n sends { id, name, ... }, we use { actor, actorName, ... }
    const normalizedAlerts = alerts.map((a: Record<string, unknown>) => ({
      actor: (a.actor as string) ?? (a.id as string) ?? 'unknown',
      actorName: (a.actorName as string) ?? (a.name as string) ?? 'Unknown',
      failedRuns: (a.failedRuns as number) ?? 0,
      totalRuns: (a.totalRuns as number) ?? 0,
      lastError: (a.lastError as string) ?? '',
      severity: ((a.severity as string) === 'critical' ? 'critical' : 'warning') as 'warning' | 'critical'
    }))

    // Log each alert as an audit entry
    for (const alert of normalizedAlerts) {
      const source = alert.actor.includes('facebook')
        ? 'facebook'
        : alert.actor.includes('linkedin')
          ? 'linkedin'
          : 'unknown'

      await supabaseAdmin
        .from('warm_lead_trigger_audit')
        .insert({
          source,
          triggered_by: null,
          triggered_at: now,
          options: {
            type: 'actor_health_alert',
            actor: alert.actor,
            actorName: alert.actorName,
            failedRuns: alert.failedRuns,
            totalRuns: alert.totalRuns,
            lastError: alert.lastError,
            severity: alert.severity
          },
          status: 'error',
          completed_at: now
        })
    }

    // Log to console for server-side visibility
    console.warn(
      `[ACTOR ALERT] ${normalizedAlerts.length} Apify actor(s) failing:`,
      normalizedAlerts.map((a) => `${a.actorName} (${a.failedRuns}/${a.totalRuns} failed)`).join(', ')
    )

    return NextResponse.json({
      success: true,
      message: `Logged ${normalizedAlerts.length} actor health alert(s)`,
      alerts: normalizedAlerts.map((a) => ({
        actor: a.actor,
        severity: a.severity,
        failedRuns: a.failedRuns
      }))
    })
  } catch (err) {
    console.error('actor-alert error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
