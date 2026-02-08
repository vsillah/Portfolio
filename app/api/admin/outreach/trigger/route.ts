import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { triggerWarmLeadScrape } from '@/lib/n8n'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/outreach/trigger
 * Manually trigger warm lead scraping workflows
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

    const triggered: Record<string, { triggered: boolean; message: string; executionId?: string }> = {}

    // Helper to trigger a single source
    const triggerSource = async (src: 'facebook' | 'google_contacts' | 'linkedin') => {
      try {
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
      // Trigger all sources sequentially
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

      return NextResponse.json({
        success: anySucceeded,
        triggered,
        message: allSucceeded
          ? 'All warm lead scrapers triggered successfully'
          : anySucceeded
          ? 'Some warm lead scrapers triggered successfully'
          : 'Failed to trigger warm lead scrapers'
      })
    } else {
      // Trigger single source
      const result = await triggerSource(source)
      triggered[source] = result

      return NextResponse.json({
        success: result.triggered,
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
