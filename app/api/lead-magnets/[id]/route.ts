import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import {
  isValidFunnelStage,
  type LeadMagnetFunnelStage,
} from '@/lib/constants/lead-magnet-funnel'
import {
  isValidCategory,
  isValidAccessType,
  isValidLeadMagnetType,
  type LeadMagnetCategory,
  type LeadMagnetAccessType,
} from '@/lib/constants/lead-magnet-category'

export const dynamic = 'force-dynamic'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseLeadMagnetId(id: string): string | null {
  const trimmed = id?.trim()
  return trimmed && UUID_REGEX.test(trimmed) ? trimmed : null
}

function isAdmin(
  authClient: { auth: { getUser: (t: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> } },
  token: string
): Promise<boolean> {
  return authClient.auth.getUser(token).then(({ data: { user }, error }) => {
    if (error || !user) return false
    return supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then((res: { data: { role?: string } | null }) => res.data?.role === 'admin')
  })
}

/** GET: Fetch a single lead magnet by id with resolved video_url, video_thumbnail_url, presentation_url from service. Auth required (any logged-in user). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadMagnetId = parseLeadMagnetId(id)
    if (!leadMagnetId) {
      return NextResponse.json({ error: 'Invalid lead magnet ID' }, { status: 400 })
    }

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

    const { data: row, error } = await supabaseAdmin
      .from('lead_magnets')
      .select('*')
      .eq('id', leadMagnetId)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 })
    }

    const lm = row as Record<string, unknown> & { is_active?: boolean; category?: string; access_type?: string; service_id?: string | null }
    if (!lm.is_active) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 })
    }

    // Non-admin: only allow gate_keeper + public_gated (same as Resources list)
    const isAdminUser = await isAdmin(supabase, token)
    if (!isAdminUser && (lm.category !== 'gate_keeper' || lm.access_type !== 'public_gated')) {
      return NextResponse.json({ error: 'Lead magnet not found' }, { status: 404 })
    }

    let result = {
      ...lm,
      file_path: (lm.file_path ?? lm.file_url ?? null) as string | null,
    } as Record<string, unknown> & { service_id?: string | null }

    if (result.service_id) {
      const { data: service } = await supabaseAdmin
        .from('services')
        .select('id, title, video_url, video_thumbnail_url, presentation_url')
        .eq('id', result.service_id)
        .single()
      type ServiceRow = { id: string; title?: string | null; video_url?: string | null; video_thumbnail_url?: string | null; presentation_url?: string | null }
      const svc = service as ServiceRow | null
      if (svc) {
        result.video_url = svc.video_url ?? null
        result.video_thumbnail_url = svc.video_thumbnail_url ?? null
        result.presentation_url = svc.presentation_url ?? null
        result.service_title = svc.title ?? null
      }
    }

    return NextResponse.json({ leadMagnet: result })
  } catch (err) {
    console.error('Lead magnet GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadMagnetId = parseLeadMagnetId(id)
    if (!leadMagnetId) {
      return NextResponse.json({ error: 'Invalid lead magnet ID' }, { status: 400 })
    }

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const admin = await isAdmin(supabase, token)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string') updates.title = body.title
    if (body.description !== undefined) updates.description = body.description === '' ? null : body.description
    if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
    if (typeof body.file_path === 'string') updates.file_path = body.file_path
    if (typeof body.file_type === 'string') updates.file_type = body.file_type
    if (typeof body.file_size === 'number') updates.file_size = body.file_size
    if (typeof body.slug === 'string') updates.slug = body.slug || null

    if (typeof body.category === 'string' && isValidCategory(body.category)) {
      updates.category = body.category as LeadMagnetCategory
    }
    if (typeof body.access_type === 'string' && isValidAccessType(body.access_type)) {
      updates.access_type = body.access_type as LeadMagnetAccessType
    }
    if (typeof body.funnel_stage === 'string' && isValidFunnelStage(body.funnel_stage)) {
      updates.funnel_stage = body.funnel_stage as LeadMagnetFunnelStage
    }
    if (typeof body.display_order === 'number' && Number.isInteger(body.display_order)) {
      updates.display_order = body.display_order
    }
    if (typeof body.private_link_token === 'string' || body.private_link_token === null) {
      updates.private_link_token = body.private_link_token || null
    }
    if (body.outcome_group_id !== undefined) {
      updates.outcome_group_id = body.outcome_group_id === null || body.outcome_group_id === '' ? null : (typeof body.outcome_group_id === 'string' ? body.outcome_group_id : null)
    }
    if (typeof body.type === 'string' && isValidLeadMagnetType(body.type)) {
      updates.type = body.type
    }
    if (body.service_id !== undefined) {
      updates.service_id = body.service_id === null || body.service_id === '' ? null : (typeof body.service_id === 'string' ? body.service_id : null)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('lead_magnets')
      .update(updates)
      .eq('id', leadMagnetId)
      .select()
      .single()

    if (error) {
      console.error('Lead magnet PATCH error:', error)
      return NextResponse.json(
        { error: 'Failed to update lead magnet', details: (error as Error).message },
        { status: 500 }
      )
    }

    const normalized = data && typeof data === 'object' && 'file_path' in data
      ? { ...data, file_path: (data as { file_path?: string; file_url?: string }).file_path ?? (data as { file_url?: string }).file_url ?? null }
      : data
    return NextResponse.json({ leadMagnet: normalized })
  } catch (err) {
    console.error('Lead magnet PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const leadMagnetId = parseLeadMagnetId(id)
    if (!leadMagnetId) {
      return NextResponse.json({ error: 'Invalid lead magnet ID' }, { status: 400 })
    }

    const authHeader = _request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const admin = await isAdmin(supabase, token)
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabaseAdmin
      .from('lead_magnets')
      .delete()
      .eq('id', leadMagnetId)

    if (error) {
      console.error('Lead magnet DELETE error:', error)
      return NextResponse.json(
        { error: 'Failed to delete lead magnet', details: (error as Error).message },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Lead magnet DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
