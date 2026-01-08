import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getCurrentUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    const { id: prototypeId } = params
    const { searchParams } = new URL(request.url)
    
    // Get date range (default: last 30 days)
    const days = parseInt(searchParams.get('days') || '30')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Check if prototype exists and get stage
    const { data: prototype } = await supabaseAdmin
      .from('app_prototypes')
      .select('production_stage')
      .eq('id', prototypeId)
      .single()

    if (!prototype) {
      return NextResponse.json(
        { error: 'Prototype not found' },
        { status: 404 }
      )
    }

    // Fetch analytics
    const { data: analytics, error } = await supabaseAdmin
      .from('prototype_analytics')
      .select('*')
      .eq('prototype_id', prototypeId)
      .gte('metric_date', startDate.toISOString().split('T')[0])
      .order('metric_date', { ascending: false })

    if (error) throw error

    // If not production, only admins can see analytics
    const isUserAdmin = user ? await isAdmin(user.id) : false
    if (prototype.production_stage !== 'Production' && !isUserAdmin) {
      return NextResponse.json(
        { error: 'Analytics only available for production prototypes' },
        { status: 403 }
      )
    }

    // Aggregate metrics by type
    const aggregated: Record<string, any> = {}
    const dailyMetrics: Record<string, Record<string, number>> = {}

    analytics?.forEach((metric: any) => {
      const date = metric.metric_date
      const type = metric.metric_type

      // Daily metrics
      if (!dailyMetrics[date]) {
        dailyMetrics[date] = {}
      }
      dailyMetrics[date][type] = Number(metric.metric_value)

      // Aggregated totals
      if (!aggregated[type]) {
        aggregated[type] = {
          total: 0,
          average: 0,
          max: 0,
          min: Infinity,
          count: 0,
        }
      }

      const value = Number(metric.metric_value)
      aggregated[type].total += value
      aggregated[type].max = Math.max(aggregated[type].max, value)
      aggregated[type].min = Math.min(aggregated[type].min, value)
      aggregated[type].count += 1
    })

    // Calculate averages
    Object.keys(aggregated).forEach(type => {
      aggregated[type].average = aggregated[type].count > 0
        ? aggregated[type].total / aggregated[type].count
        : 0
      if (aggregated[type].min === Infinity) {
        aggregated[type].min = 0
      }
    })

    return NextResponse.json({
      aggregated,
      daily: dailyMetrics,
      raw: isUserAdmin ? analytics : undefined, // Only admins get raw data
    })
  } catch (error: any) {
    console.error('Error fetching analytics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
