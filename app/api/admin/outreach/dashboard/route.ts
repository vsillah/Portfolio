import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { computeFunnel, computeFunnelBySource } from './funnel-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/outreach/dashboard
 * Lead pipeline dashboard metrics (cold + warm)
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

    // 1. Fetch ALL outbound leads (cold + warm)
    // Use ilike (case-insensitive) to match lead_source patterns
    const { data: allContacts } = await supabaseAdmin
      .from('contact_submissions')
      .select('id, lead_source, outreach_status, lead_score, qualification_status, created_at')
      .or('lead_source.ilike.cold_%,lead_source.ilike.warm_%')

    const contacts: Array<{
      id: string
      lead_source: string | null
      outreach_status: string
      lead_score: number | null
      qualification_status: string | null
      created_at: string
    }> = allContacts || []

    // Split into cold and warm
    const coldContacts = contacts.filter(c => c.lead_source?.startsWith('cold_'))
    const warmContacts = contacts.filter(c => c.lead_source?.startsWith('warm_'))

    // 2. Overall funnel (all outbound leads)
    const funnel = computeFunnel(contacts)

    // 3. Cold-only funnel
    const coldFunnel = computeFunnel(coldContacts)

    // 4. Warm-only funnel
    const warmFunnel = computeFunnel(warmContacts)

    // 5. Funnel by source (all)
    const funnelBySource = computeFunnelBySource(contacts)

    // 6. Temperature breakdown
    const funnelByTemperature = {
      cold: coldFunnel,
      warm: warmFunnel,
    }

    // 7. Warm source breakdown (per warm source type)
    const warmSourceBreakdown = computeFunnelBySource(warmContacts)

    // 8. Outreach queue stats
    type QueueItem = {
      id: string
      status: string
      channel: string
      sequence_step: number
      sent_at: string | null
      replied_at: string | null
      created_at: string
    }
    const { data: rawQueueItems } = await supabaseAdmin
      .from('outreach_queue')
      .select('id, status, channel, sequence_step, sent_at, replied_at, created_at')
    const queueItems: QueueItem[] = rawQueueItems || []

    const queueStats = {
      total: queueItems.length,
      draft: queueItems.filter(q => q.status === 'draft').length,
      approved: queueItems.filter(q => q.status === 'approved').length,
      sent: queueItems.filter(q => q.status === 'sent').length,
      replied: queueItems.filter(q => q.status === 'replied').length,
      bounced: queueItems.filter(q => q.status === 'bounced').length,
    }

    // 9. Channel breakdown
    const emailItems = queueItems.filter(q => q.channel === 'email')
    const linkedinItems = queueItems.filter(q => q.channel === 'linkedin')

    const channelStats = {
      email: {
        total: emailItems.length,
        sent: emailItems.filter(q => q.status === 'sent').length,
        replied: emailItems.filter(q => q.status === 'replied').length,
        reply_rate: emailItems.filter(q => ['sent', 'replied'].includes(q.status)).length > 0
          ? Math.round(
              (emailItems.filter(q => q.status === 'replied').length /
                emailItems.filter(q => ['sent', 'replied'].includes(q.status)).length) * 100
            )
          : 0,
      },
      linkedin: {
        total: linkedinItems.length,
        sent: linkedinItems.filter(q => q.status === 'sent').length,
        replied: linkedinItems.filter(q => q.status === 'replied').length,
        reply_rate: linkedinItems.filter(q => ['sent', 'replied'].includes(q.status)).length > 0
          ? Math.round(
              (linkedinItems.filter(q => q.status === 'replied').length /
                linkedinItems.filter(q => ['sent', 'replied'].includes(q.status)).length) * 100
            )
          : 0,
      },
    }

    // 10. Sequence step performance
    const stepStats: Record<number, { sent: number; replied: number }> = {}
    for (const item of queueItems) {
      const step = item.sequence_step
      if (!stepStats[step]) stepStats[step] = { sent: 0, replied: 0 }
      if (item.status === 'sent' || item.status === 'replied') stepStats[step].sent++
      if (item.status === 'replied') stepStats[step].replied++
    }

    // 11. Recent activity (last 10 sent/replied)
    const { data: recentActivity } = await supabaseAdmin
      .from('outreach_queue')
      .select(`
        id,
        channel,
        subject,
        status,
        sequence_step,
        sent_at,
        replied_at,
        contact_submissions (
          id,
          name,
          company,
          lead_score
        )
      `)
      .in('status', ['sent', 'replied'])
      .order('updated_at', { ascending: false })
      .limit(10)

    // 12. Lead source stats (cold_lead_sources table - now supports warm platforms too)
    const { data: sourceStats } = await supabaseAdmin
      .from('cold_lead_sources')
      .select('id, name, platform, total_leads_found, total_leads_qualified, total_leads_replied, total_leads_booked, last_run_at, is_active')
      .order('last_run_at', { ascending: false })

    return NextResponse.json({
      funnel,
      coldFunnel,
      warmFunnel,
      funnelBySource,
      funnelByTemperature,
      warmSourceBreakdown,
      queueStats,
      channelStats,
      stepStats,
      recentActivity: recentActivity || [],
      leadSources: sourceStats || [],
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/dashboard:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
