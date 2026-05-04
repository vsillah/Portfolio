import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const SOURCE_PROTOCOL_TABLES = [
  'source_creator_portal_accounts',
  'source_creators',
  'licensed_works',
  'license_grants',
  'source_chunks',
  'answer_receipt_chunks',
  'monthly_creator_payouts',
  'creator_rights_disputes',
] as const

function isMissingSourceProtocolSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    SOURCE_PROTOCOL_TABLES.some((table) => message.includes(table)) ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

async function selectRows(table: string, columns: string, column: string, value: string, orderColumn = 'created_at') {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .eq(column, value)
    .order(orderColumn, { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const { data: portal, error: portalError } = await supabaseAdmin
      .from('source_creator_portal_accounts')
      .select('id, creator_id, status, can_view_earnings, can_view_receipts, accepted_at, created_at')
      .eq('user_id', auth.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (portalError) throw portalError

    if (!portal) {
      return NextResponse.json({
        available: true,
        linked: false,
        generatedAt: new Date().toISOString(),
        reason: 'No active creator portal account is linked to this login yet.',
      })
    }

    const creatorId = portal.creator_id

    const [
      creator,
      works,
      chunks,
      payouts,
      attributedChunks,
      disputes,
    ] = await Promise.all([
      supabaseAdmin
        .from('source_creators')
        .select('id, display_name, categories, rights_holder_types, verification_status, protected_identity, public_bio, created_at')
        .eq('id', creatorId)
        .maybeSingle(),
      selectRows(
        'licensed_works',
        'id, title, rights_holder_type, ban_status, chain_of_title_verified, community_consent_required, community_consent_verified, review_status, sensitivity_flags, created_at',
        'creator_id',
        creatorId
      ),
      selectRows(
        'source_chunks',
        'id, work_id, citation_label, source_location, sensitive_topics, is_retrievable, created_at',
        'creator_id',
        creatorId
      ),
      portal.can_view_earnings ? selectRows(
        'monthly_creator_payouts',
        'id, settlement_period, answer_receipt_ids, attributed_chunk_count, attributed_token_count, accrued_payout_usd, settlement_status, hold_reason, approved_at, paid_at, created_at',
        'creator_id',
        creatorId
      ) : Promise.resolve([]),
      portal.can_view_receipts ? selectRows(
        'answer_receipt_chunks',
        'answer_receipt_id, source_chunk_external_id, work_external_id, citation_label, supported_output_tokens, attribution_weight, accrued_payout_usd, created_at',
        'creator_id',
        creatorId
      ) : Promise.resolve([]),
      selectRows(
        'creator_rights_disputes',
        'id, dispute_type, status, summary, resolution_notes, resolved_at, created_at',
        'creator_id',
        creatorId
      ),
    ])

    if (creator.error) throw creator.error
    if (!creator.data) {
      return NextResponse.json({ error: 'Linked creator profile was not found' }, { status: 404 })
    }

    const workIds = works.map((work: any) => work.id)
    const { data: grants, error: grantsError } = workIds.length > 0
      ? await supabaseAdmin
        .from('license_grants')
        .select('id, work_id, status, allowed_uses, blocked_topics, quote_limit_characters, expires_at, reviewed_at, created_at')
        .in('work_id', workIds)
        .order('created_at', { ascending: false })
      : { data: [], error: null }

    if (grantsError) throw grantsError

    const accruedPayoutUsd = payouts.reduce((sum: number, payout: any) => (
      sum + Number(payout.accrued_payout_usd ?? 0)
    ), 0)
    const attributedTokenCount = payouts.reduce((sum: number, payout: any) => (
      sum + Number(payout.attributed_token_count ?? 0)
    ), 0)
    const heldPayouts = payouts.filter((payout: any) => payout.settlement_status === 'held_for_review').length
    const openDisputes = disputes.filter((dispute: any) => ['open', 'investigating'].includes(dispute.status)).length

    return NextResponse.json({
      available: true,
      linked: true,
      generatedAt: new Date().toISOString(),
      portal,
      creator: creator.data,
      summary: {
        works: works.length,
        activeGrants: (grants ?? []).filter((grant: any) => grant.status === 'active').length,
        retrievableChunks: chunks.filter((chunk: any) => chunk.is_retrievable).length,
        attributedReceipts: new Set(attributedChunks.map((chunk: any) => chunk.answer_receipt_id)).size,
        monthlyPayouts: payouts.length,
        accruedPayoutUsd: Number(accruedPayoutUsd.toFixed(6)),
        attributedTokenCount,
        heldPayouts,
        openDisputes,
      },
      works,
      licenseGrants: grants ?? [],
      chunks,
      payouts: portal.can_view_earnings ? payouts : [],
      attributedChunks: portal.can_view_receipts ? attributedChunks : [],
      disputes,
    })
  } catch (error: any) {
    if (isMissingSourceProtocolSchema(error)) {
      return NextResponse.json({
        available: false,
        linked: false,
        generatedAt: new Date().toISOString(),
        reason: 'Source protocol creator portal schema has not been applied in this environment.',
        migration: 'supabase/migrations/20260504092130_source_protocol_creator_portal.sql',
      })
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to load creator source protocol statement' },
      { status: 500 }
    )
  }
}
