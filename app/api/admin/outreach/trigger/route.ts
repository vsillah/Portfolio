import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerWarmLeadScrape } from '@/lib/n8n'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/** Returns false if the last successful run for this source was within 24 hours. */
async function shouldRunScrape(source: 'facebook' | 'google_contacts' | 'linkedin'): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('warm_lead_trigger_audit')
    .select('completed_at, triggered_at')
    .eq('source', source)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return true
  const lastAt = data.completed_at ?? data.triggered_at
  if (!lastAt) return true
  return Date.now() - new Date(lastAt).getTime() >= TWENTY_FOUR_HOURS_MS
}

/**
 * POST /api/admin/outreach/trigger
 * Manually trigger warm lead scraping workflows.
 * Skips calling n8n when the last successful run for that source was within 24 hours (returns skipped: true).
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdmin(request)

    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const userId = authResult.user.id
    const body = await request.json()
    const { source, options } = body as {
      source: 'facebook' | 'google_contacts' | 'linkedin' | 'all'
      options?: {
        group_uids?: string[]
        profile_url?: string
        linkedin_profile_url?: string
        scrape_type?: 'connections' | 'engagement' | 'both'
        max_leads?: number
      }
    }

    if (!source) {
      return NextResponse.json(
        { error: 'source is required' },
        { status: 400 }
      )
    }

    const validSources = ['facebook', 'google_contacts', 'linkedin', 'all']
    if (!validSources.includes(source)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      )
    }

    const triggered: Record<string, { triggered: boolean; message: string; skipped?: boolean; executionId?: string }> = {}

    // Helper to trigger a single source
    const triggerSource = async (src: 'facebook' | 'google_contacts' | 'linkedin') => {
      try {
        const allowRun = await shouldRunScrape(src)
        if (!allowRun) {
          return {
            triggered: false,
            message: 'Skipped: last run within 24 hours',
            skipped: true
          }
        }

        const result = await triggerWarmLeadScrape({
          source: src,
          options: options || {}
        })

        // Create audit log entry
        await supabaseAdmin
          .from('warm_lead_trigger_audit')
          .insert({
            source: src,
            triggered_by: userId,
            options: options || {},
            status: result.triggered ? 'running' : 'failed',
            error_message: result.triggered ? null : result.message
          })

        return result
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        
        // Create audit log entry for failure
        await supabaseAdmin
          .from('warm_lead_trigger_audit')
          .insert({
            source: src,
            triggered_by: userId,
            options: options || {},
            status: 'failed',
            error_message: errorMsg
          })

        return {
          triggered: false,
          message: errorMsg
        }
      }
    }

    // Trigger based on source
    if (source === 'all') {
      // Trigger all sources in parallel
      const [fbResult, gcResult, liResult] = await Promise.all([
        triggerSource('facebook'),
        triggerSource('google_contacts'),
        triggerSource('linkedin')
      ])

      triggered.facebook = fbResult
      triggered.google_contacts = gcResult
      triggered.linkedin = liResult

      const allSucceeded = fbResult.triggered && gcResult.triggered && liResult.triggered
      const anySucceeded = fbResult.triggered || gcResult.triggered || liResult.triggered
      const allSkipped = [fbResult, gcResult, liResult].every((r) => (r as { skipped?: boolean }).skipped)

      return NextResponse.json({
        success: anySucceeded || allSkipped,
        triggered,
        message: allSucceeded
          ? 'All warm lead scrapers triggered successfully'
          : allSkipped
          ? 'All skipped: last run within 24 hours'
          : anySucceeded
          ? 'Some warm lead scrapers triggered successfully'
          : 'Failed to trigger warm lead scrapers'
      })
    } else {
      // Trigger single source
      const result = await triggerSource(source)
      triggered[source] = result
      const skipped = (result as { skipped?: boolean }).skipped

      return NextResponse.json({
        success: result.triggered || skipped,
        triggered,
        message: result.message
      })
    }
  } catch (error) {
    console.error('Error in POST /api/admin/outreach/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/outreach/trigger
 * Get recent trigger history
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyAdmin(request)

    if (isAuthError(authResult)) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status }
      )
    }

    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'all'
    const limit = parseInt(searchParams.get('limit') || '10')

    let query = supabaseAdmin
      .from('warm_lead_trigger_audit')
      .select(`
        id,
        source,
        triggered_at,
        status,
        leads_found,
        leads_inserted,
        error_message,
        completed_at
      `)
      .order('triggered_at', { ascending: false })
      .limit(limit)

    if (source !== 'all') {
      query = query.eq('source', source)
    }

    const { data: history, error } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      history: history || []
    })
  } catch (error) {
    console.error('Error in GET /api/admin/outreach/trigger:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
