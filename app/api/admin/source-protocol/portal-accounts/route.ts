import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'active', 'suspended', 'revoked'] as const
type PortalStatus = (typeof STATUSES)[number]

function isMissingSourceProtocolSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    message.includes('source_creator_portal_accounts') ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isStatus(value: unknown): value is PortalStatus {
  return typeof value === 'string' && STATUSES.includes(value as PortalStatus)
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

async function ensureCreatorAndUser(creatorId: string, userId: string) {
  const [creatorResult, userResult] = await Promise.all([
    supabaseAdmin
      .from('source_creators')
      .select('id')
      .eq('id', creatorId)
      .maybeSingle(),
    supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (creatorResult.error) throw creatorResult.error
  if (userResult.error) throw userResult.error
  if (!creatorResult.data) return 'Creator not found'
  if (!userResult.data) return 'User not found'
  return null
}

function selectAccount() {
  return 'id, creator_id, user_id, status, can_view_earnings, can_view_receipts, invited_by, invited_at, accepted_at, created_at, updated_at'
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const creatorId = body.creatorId
    const userId = body.userId
    const status = isStatus(body.status) ? body.status : 'active'

    if (!isUuid(creatorId) || !isUuid(userId)) {
      return NextResponse.json({ error: 'creatorId and userId must be valid UUIDs' }, { status: 400 })
    }

    const missing = await ensureCreatorAndUser(creatorId, userId)
    if (missing) return NextResponse.json({ error: missing }, { status: 404 })

    const now = new Date().toISOString()
    const row = {
      creator_id: creatorId,
      user_id: userId,
      status,
      can_view_earnings: boolOrDefault(body.canViewEarnings, true),
      can_view_receipts: boolOrDefault(body.canViewReceipts, true),
      invited_by: auth.user.id,
      invited_at: now,
      accepted_at: status === 'active' ? now : null,
    }

    const { data, error } = await supabaseAdmin
      .from('source_creator_portal_accounts')
      .upsert(row, { onConflict: 'creator_id,user_id' })
      .select(selectAccount())
      .single()

    if (error) throw error

    return NextResponse.json({ ok: true, account: data })
  } catch (error: any) {
    if (isMissingSourceProtocolSchema(error)) {
      return NextResponse.json(
        {
          error: 'Source protocol creator portal schema has not been applied in this environment.',
          migration: 'supabase/migrations/20260504092130_source_protocol_creator_portal.sql',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to create portal account' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const accountId = body.accountId

    if (!isUuid(accountId)) {
      return NextResponse.json({ error: 'accountId must be a valid UUID' }, { status: 400 })
    }

    const update: Record<string, unknown> = {}
    if (body.status !== undefined) {
      if (!isStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid portal account status' }, { status: 400 })
      }
      update.status = body.status
      if (body.status === 'active') update.accepted_at = new Date().toISOString()
    }
    if (body.canViewEarnings !== undefined) update.can_view_earnings = boolOrDefault(body.canViewEarnings, true)
    if (body.canViewReceipts !== undefined) update.can_view_receipts = boolOrDefault(body.canViewReceipts, true)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('source_creator_portal_accounts')
      .update(update)
      .eq('id', accountId)
      .select(selectAccount())
      .maybeSingle()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Portal account not found' }, { status: 404 })

    return NextResponse.json({ ok: true, account: data })
  } catch (error: any) {
    if (isMissingSourceProtocolSchema(error)) {
      return NextResponse.json(
        {
          error: 'Source protocol creator portal schema has not been applied in this environment.',
          migration: 'supabase/migrations/20260504092130_source_protocol_creator_portal.sql',
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to update portal account' },
      { status: 500 }
    )
  }
}
