import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Public route - user is optional
    let user = null
    try {
      user = await getCurrentUser()
    } catch (error) {
      // Ignore auth errors - route is public
    }
    const { searchParams } = new URL(request.url)
    
    // Optional filters from query params
    const stage = searchParams.get('stage')
    const channel = searchParams.get('channel')
    const type = searchParams.get('type')

    // Build query - start simple, add relations only if tables exist
    let query = supabaseAdmin
      .from('app_prototypes')
      .select('*')
      .order('created_at', { ascending: false })

    // Apply filters
    if (stage) {
      query = query.eq('production_stage', stage)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }
    if (type) {
      query = query.eq('product_type', type)
    }

    const { data: prototypes, error } = await query

    if (error) {
      console.error('Supabase query error:', error)
      // If table doesn't exist, return empty array instead of error
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('relation') || error.details?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    // If no prototypes, return early
    if (!prototypes || prototypes.length === 0) {
      return NextResponse.json([])
    }

    // Try to fetch related data (demos, history) separately to avoid relation errors
    const prototypeIds = prototypes.map((p: any) => p.id)
    
    let demosMap: Record<string, any[]> = {}
    let historyMap: Record<string, any[]> = {}
    
    try {
      const { data: demos } = await supabaseAdmin
        .from('prototype_demos')
        .select('*')
        .in('prototype_id', prototypeIds)
      
      if (demos) {
        demos.forEach((demo: any) => {
          if (!demosMap[demo.prototype_id]) {
            demosMap[demo.prototype_id] = []
          }
          demosMap[demo.prototype_id].push(demo)
        })
      }
    } catch (err) {
      console.warn('Could not fetch demos:', err)
    }

    try {
      const { data: history } = await supabaseAdmin
        .from('prototype_stage_history')
        .select('*')
        .in('prototype_id', prototypeIds)
      
      if (history) {
        history.forEach((h: any) => {
          if (!historyMap[h.prototype_id]) {
            historyMap[h.prototype_id] = []
          }
          historyMap[h.prototype_id].push(h)
        })
      }
    } catch (err) {
      console.warn('Could not fetch stage history:', err)
    }

    // Fetch enrollment status for logged-in users
    let enrollments: any[] = []
    if (user) {
      try {
        const { data } = await supabaseAdmin
          .from('prototype_enrollments')
          .select('prototype_id, enrollment_type')
          .eq('user_id', user.id)

        enrollments = data || []
      } catch (err) {
        // Table might not exist yet, ignore error
        console.warn('Could not fetch enrollments:', err)
      }
    }

    // Fetch feedback counts for production prototypes
    const productionIds = (prototypes || [])
      .filter((p: any) => p.production_stage === 'Production')
      .map((p: any) => p.id)

    let feedbackCounts: Record<string, number> = {}
    if (productionIds.length > 0) {
      try {
        const { data: feedback } = await supabaseAdmin
          .from('prototype_feedback')
          .select('prototype_id')
          .in('prototype_id', productionIds)

        feedbackCounts = (feedback || []).reduce((acc: Record<string, number>, fb: any) => {
          acc[fb.prototype_id] = (acc[fb.prototype_id] || 0) + 1
          return acc
        }, {})
      } catch (err) {
        // Table might not exist yet, ignore error
        console.warn('Could not fetch feedback counts:', err)
      }
    }

    // Fetch analytics for production prototypes (public metrics only)
    let analytics: Record<string, any> = {}
    if (productionIds.length > 0) {
      try {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const { data: analyticsData } = await supabaseAdmin
          .from('prototype_analytics')
          .select('prototype_id, metric_type, metric_value')
          .in('prototype_id', productionIds)
          .gte('metric_date', thirtyDaysAgo.toISOString().split('T')[0])
        
        // Aggregate analytics
        if (analyticsData) {
          analyticsData.forEach((metric: any) => {
            if (!analytics[metric.prototype_id]) {
              analytics[metric.prototype_id] = {}
            }
            if (metric.metric_type === 'active-users') {
              analytics[metric.prototype_id].active_users = Math.max(
                analytics[metric.prototype_id].active_users || 0,
                Number(metric.metric_value)
              )
            } else if (metric.metric_type === 'pageviews') {
              analytics[metric.prototype_id].pageviews = 
                (analytics[metric.prototype_id].pageviews || 0) + Number(metric.metric_value)
            } else if (metric.metric_type === 'downloads') {
              analytics[metric.prototype_id].downloads = 
                (analytics[metric.prototype_id].downloads || 0) + Number(metric.metric_value)
            }
          })
        }
      } catch (err) {
        // Table might not exist yet, ignore error
        console.warn('Could not fetch analytics:', err)
      }
    }

    // Combine data
    const enrichedPrototypes = prototypes.map((prototype: any) => {
      const enrollment = enrollments.find((e: any) => e.prototype_id === prototype.id)
      
      // Sort demos by display_order
      const sortedDemos = (demosMap[prototype.id] || []).sort((a: any, b: any) => 
        a.display_order - b.display_order
      )
      
      // Sort stage history by date (most recent first)
      const sortedHistory = (historyMap[prototype.id] || []).sort((a: any, b: any) => 
        new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
      )
      
      return {
        ...prototype,
        demos: sortedDemos,
        stage_history: sortedHistory,
        user_enrollment: enrollment?.enrollment_type || null,
        feedback_count: feedbackCounts[prototype.id] || 0,
        analytics: analytics[prototype.id] || undefined,
      }
    })

    return NextResponse.json(enrichedPrototypes)
  } catch (error: any) {
    console.error('Error fetching prototypes:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prototypes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get the session token from the Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body first
    const body = await request.json()
    const {
      title,
      description,
      purpose,
      production_stage,
      channel,
      product_type,
      thumbnail_url,
      download_url,
      app_repo_url,
      deployment_platform,
      analytics_source,
      analytics_project_id,
    } = body

    if (!title || !description || !purpose || !production_stage || !channel || !product_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify the user with the token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin by fetching their profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('app_prototypes')
      .insert([{
        title,
        description,
        purpose,
        production_stage,
        channel,
        product_type,
        thumbnail_url: thumbnail_url || null,
        download_url: download_url || null,
        app_repo_url: app_repo_url || null,
        deployment_platform: deployment_platform || null,
        analytics_source: analytics_source || null,
        analytics_project_id: analytics_project_id || null,
        created_by: user.id,
      }])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating prototype:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create prototype' },
      { status: 500 }
    )
  }
}
