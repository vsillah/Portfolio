import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  LEAD_MAGNET_FUNNEL_STAGES,
  FUNNEL_STAGE_LABELS,
  isValidFunnelStage,
} from '@/lib/constants/lead-magnet-funnel'
import { isValidCategory, isValidAccessType, isValidLeadMagnetType } from '@/lib/constants/lead-magnet-category'

export const dynamic = 'force-dynamic'

/** Canonical funnel order index for sorting */
const FUNNEL_ORDER: Record<string, number> = Object.fromEntries(
  LEAD_MAGNET_FUNNEL_STAGES.map((s, i) => [s, i])
)

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized - token required' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const adminMode = searchParams.get('admin') === '1'
    let category = searchParams.get('category') ?? undefined
    let accessType = searchParams.get('access_type') ?? undefined
    const funnelStageParam = searchParams.get('funnel_stage') ?? undefined
    // filter === 'all' or omitted → no restriction on funnel_stage
    const funnelStage =
      funnelStageParam && funnelStageParam !== 'all' && isValidFunnelStage(funnelStageParam)
        ? funnelStageParam
        : undefined

    if (adminMode) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    let query = supabaseAdmin
      .from('lead_magnets')
      .select('*')

    if (!adminMode) {
      query = query.eq('is_active', true)
    }
    if (category) query = query.eq('category', category)
    if (accessType) query = query.eq('access_type', accessType)
    if (funnelStage) query = query.eq('funnel_stage', funnelStage)

    const { data: rows, error } = await query.order('display_order', { ascending: true }).order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching lead magnets:', error)
      return NextResponse.json({ error: 'Failed to fetch lead magnets' }, { status: 500 })
    }

    const leadMagnets = (rows || []) as Array<Record<string, unknown> & { funnel_stage?: string }>
    const normalized = leadMagnets.map((m) => ({
      ...m,
      file_path: (m.file_path ?? m.file_url ?? null) as string | null,
      funnel_stage_label: m.funnel_stage ? FUNNEL_STAGE_LABELS[m.funnel_stage as keyof typeof FUNNEL_STAGE_LABELS] ?? m.funnel_stage : undefined,
    })) as Array<Record<string, unknown> & { funnel_stage?: string; funnel_stage_label?: string; file_path: string | null; display_order?: number; created_at?: string }>

    // Sort by canonical funnel order, then display_order, then created_at
    normalized.sort((a, b) => {
      const stageA = (a.funnel_stage as string) ?? ''
      const stageB = (b.funnel_stage as string) ?? ''
      const orderA = FUNNEL_ORDER[stageA] ?? 999
      const orderB = FUNNEL_ORDER[stageB] ?? 999
      if (orderA !== orderB) return orderA - orderB
      const dispA = (a.display_order as number) ?? 0
      const dispB = (b.display_order as number) ?? 0
      if (dispA !== dispB) return dispA - dispB
      return new Date((a.created_at as string) ?? 0).getTime() - new Date((b.created_at as string) ?? 0).getTime()
    })

    return NextResponse.json({ leadMagnets: normalized })
  } catch (error) {
    console.error('Lead magnets API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      file_path,
      file_type,
      file_size,
      category: bodyCategory,
      access_type: bodyAccessType,
      funnel_stage: bodyFunnelStage,
      display_order: bodyDisplayOrder,
      slug,
      outcome_group_id,
      type: bodyType,
    } = body as Record<string, unknown>

    if (!title || !file_path || !file_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const category = typeof bodyCategory === 'string' && isValidCategory(bodyCategory) ? bodyCategory : 'gate_keeper'
    const accessType = typeof bodyAccessType === 'string' && isValidAccessType(bodyAccessType) ? bodyAccessType : 'public_gated'
    const funnelStage = typeof bodyFunnelStage === 'string' && isValidFunnelStage(bodyFunnelStage) ? bodyFunnelStage : 'attention_capture'
    const type = typeof bodyType === 'string' && isValidLeadMagnetType(bodyType) ? bodyType : 'pdf'

    let displayOrder = typeof bodyDisplayOrder === 'number' && Number.isInteger(bodyDisplayOrder) ? bodyDisplayOrder : undefined
    if (displayOrder === undefined) {
      const { data: maxRow } = await supabaseAdmin
        .from('lead_magnets')
        .select('display_order')
        .eq('funnel_stage', funnelStage)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      displayOrder = ((maxRow as { display_order?: number } | null)?.display_order ?? -1) + 1
    }

    const basePayload = {
      title,
      description: description ?? null,
      file_type,
      file_size: file_size ?? null,
      is_active: true,
      category,
      access_type: accessType,
      funnel_stage: funnelStage,
      display_order: displayOrder,
      type,
      ...(typeof slug === 'string' && slug ? { slug } : {}),
      ...(typeof outcome_group_id === 'string' && outcome_group_id ? { outcome_group_id } : outcome_group_id === null ? { outcome_group_id: null } : {}),
    }

    const insertCandidates = [
      { ...basePayload, file_path },
      { ...basePayload, file_url: file_path },
    ]

    let data: unknown = null
    let lastError: unknown = null

    for (const candidate of insertCandidates) {
      const result = await supabaseAdmin
        .from('lead_magnets')
        .insert([candidate])
        .select()
        .single()

      if (!result.error) {
        data = result.data
        lastError = null
        break
      }

      lastError = result.error
      const msg = String((result.error as Error)?.message || '')
      if (!msg.includes('Could not find the') && !msg.includes('column') && !msg.includes('schema cache')) {
        break
      }
    }

    if (lastError) {
      console.error('Error creating lead magnet:', lastError)
      return NextResponse.json(
        {
          error: 'Failed to create lead magnet',
          details: (lastError as Error)?.message ?? null,
        },
        { status: 500 }
      )
    }

    const normalized = data && typeof data === 'object' && 'file_path' in data
      ? { ...data, file_path: (data as { file_path?: string; file_url?: string }).file_path ?? (data as { file_url?: string }).file_url ?? null }
      : data
    return NextResponse.json({ leadMagnet: normalized }, { status: 201 })
  } catch (error) {
    console.error('Lead magnets POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
