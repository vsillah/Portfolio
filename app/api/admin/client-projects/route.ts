import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/client-projects
 * List all client projects with milestone summary data
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = (page - 1) * limit

    // Build query -- fetch client_projects without join first
    // (onboarding_plans table may not exist yet or FK may not be in schema cache)
    let query = supabaseAdmin
      .from('client_projects')
      .select(
        `
        id,
        client_id,
        client_name,
        client_email,
        client_company,
        slack_channel,
        project_status,
        current_phase,
        product_purchased,
        project_start_date,
        estimated_end_date,
        payment_amount,
        created_at,
        updated_at
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('project_status', status)
    }

    if (search) {
      query = query.or(
        `client_name.ilike.%${search}%,client_email.ilike.%${search}%,client_company.ilike.%${search}%,product_purchased.ilike.%${search}%`
      )
    }

    const { data, error, count } = await query

    if (error) {
      console.error('Error fetching client projects:', error)
      return NextResponse.json(
        { error: 'Failed to fetch client projects' },
        { status: 500 }
      )
    }

    // Try to fetch onboarding plans separately (table may not exist yet)
    const projectIds = (data || []).map((p: Record<string, unknown>) => p.id as string)
    let plansMap: Record<string, { milestones: Array<{ status: string }>; status: string }> = {}

    if (projectIds.length > 0) {
      const { data: plans, error: plansError } = await supabaseAdmin
        .from('onboarding_plans')
        .select('client_project_id, milestones, status')
        .in('client_project_id', projectIds)

      if (plansError) {
        // onboarding_plans table may not exist yet -- gracefully continue
        console.warn('Could not fetch onboarding_plans:', plansError.message)
      } else if (plans) {
        for (const plan of plans) {
          const cpId = plan.client_project_id as string
          plansMap[cpId] = {
            milestones: (plan.milestones || []) as Array<{ status: string }>,
            status: plan.status as string,
          }
        }
      }
    }

    // Enrich with milestone summary counts
    const enriched = (data || []).map((project: Record<string, unknown>) => {
      const plan = plansMap[project.id as string] || null
      const milestones = plan?.milestones || []

      const milestoneTotal = milestones.length
      const milestoneCompleted = milestones.filter(
        (m) => m.status === 'complete'
      ).length
      const milestoneInProgress = milestones.filter(
        (m) => m.status === 'in_progress'
      ).length

      return {
        ...project,
        onboarding_plan_status: plan?.status || null,
        milestone_total: milestoneTotal,
        milestone_completed: milestoneCompleted,
        milestone_in_progress: milestoneInProgress,
      }
    })

    // Compute stats
    const allProjects = await supabaseAdmin
      .from('client_projects')
      .select('project_status')

    const stats = {
      active: 0,
      testing: 0,
      delivering: 0,
      complete: 0,
      total: allProjects.data?.length || 0,
    }

    for (const p of allProjects.data || []) {
      const s = p.project_status as string
      if (s === 'active') stats.active++
      else if (s === 'testing') stats.testing++
      else if (s === 'delivering') stats.delivering++
      else if (s === 'complete') stats.complete++
    }

    return NextResponse.json({
      projects: enriched,
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in GET /api/admin/client-projects:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
