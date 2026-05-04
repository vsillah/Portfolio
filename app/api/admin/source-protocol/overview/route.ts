import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

type CountFilter = {
  column: string
  value: string | boolean
}

const SOURCE_PROTOCOL_TABLES = [
  'source_creators',
  'licensed_works',
  'license_grants',
  'source_chunks',
  'answer_receipts',
  'answer_receipt_chunks',
  'monthly_creator_payouts',
  'creator_rights_disputes',
  'creator_rights_model_reviews',
] as const

function isMissingSourceProtocolSchema(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const message = error.message?.toLowerCase() ?? ''
  return (
    error.code === '42P01' ||
    SOURCE_PROTOCOL_TABLES.some((table) => message.includes(table)) ||
    message.includes('relation') && message.includes('does not exist')
  )
}

async function countRows(table: string, filter?: CountFilter): Promise<number> {
  let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })
  if (filter) query = query.eq(filter.column, filter.value)
  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

async function selectRows(table: string, columns: string, orderColumn: string, limit = 25) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .order(orderColumn, { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 })
  }

  try {
    const [
      creators,
      works,
      activeGrants,
      retrievableChunks,
      answerReceipts,
      monthlyPayouts,
      openDisputes,
      heldPayouts,
      creatorRows,
      workRows,
      grantRows,
      chunkRows,
      receiptRows,
      receiptChunkRows,
      payoutRows,
      disputeRows,
      modelReviewRows,
    ] = await Promise.all([
      countRows('source_creators'),
      countRows('licensed_works'),
      countRows('license_grants', { column: 'status', value: 'active' }),
      countRows('source_chunks', { column: 'is_retrievable', value: true }),
      countRows('answer_receipts'),
      countRows('monthly_creator_payouts'),
      countRows('creator_rights_disputes', { column: 'status', value: 'open' }),
      countRows('monthly_creator_payouts', { column: 'settlement_status', value: 'held_for_review' }),
      selectRows(
        'source_creators',
        'id, display_name, categories, rights_holder_types, verification_status, protected_identity, created_at',
        'created_at'
      ),
      selectRows(
        'licensed_works',
        'id, title, creator_id, rights_holder_type, ban_status, chain_of_title_verified, community_consent_required, community_consent_verified, review_status, created_at',
        'created_at'
      ),
      selectRows(
        'license_grants',
        'id, work_id, status, allowed_uses, blocked_topics, quote_limit_characters, expires_at, reviewed_at, created_at',
        'created_at'
      ),
      selectRows(
        'source_chunks',
        'id, work_id, creator_id, citation_label, source_location, is_retrievable, sensitive_topics, created_at',
        'created_at'
      ),
      selectRows(
        'answer_receipts',
        'id, model_id, generated_at, output_token_count, creator_pool_usd, cited_chunk_ids, abuse_flags, created_at',
        'generated_at'
      ),
      selectRows(
        'answer_receipt_chunks',
        'answer_receipt_id, source_chunk_external_id, creator_external_id, work_external_id, citation_label, supported_output_tokens, attribution_weight, accrued_payout_usd, created_at',
        'created_at'
      ),
      selectRows(
        'monthly_creator_payouts',
        'id, creator_external_id, settlement_period, accrued_payout_usd, settlement_status, hold_reason, attributed_token_count, answer_receipt_ids, created_at',
        'created_at'
      ),
      selectRows(
        'creator_rights_disputes',
        'id, dispute_type, status, summary, created_at',
        'created_at'
      ),
      selectRows(
        'creator_rights_model_reviews',
        'id, reviewed_at, incumbent_model_id, recommended_model_id, recommendation, quality_gate_passed, license_governance_gate_passed, created_at',
        'reviewed_at',
        10
      ),
    ])

    const accruedPayoutUsd = payoutRows.reduce((sum: number, payout: any) => {
      return sum + Number(payout.accrued_payout_usd ?? 0)
    }, 0)

    return NextResponse.json({
      available: true,
      generatedAt: new Date().toISOString(),
      summary: {
        creators,
        works,
        activeGrants,
        retrievableChunks,
        answerReceipts,
        monthlyPayouts,
        openDisputes,
        heldPayouts,
        accruedPayoutUsd: Number(accruedPayoutUsd.toFixed(6)),
      },
      creators: creatorRows,
      works: workRows,
      licenseGrants: grantRows,
      chunks: chunkRows,
      receipts: receiptRows,
      receiptChunks: receiptChunkRows,
      monthlyPayouts: payoutRows,
      disputes: disputeRows,
      modelReviews: modelReviewRows,
    })
  } catch (error: any) {
    if (isMissingSourceProtocolSchema(error)) {
      return NextResponse.json({
        available: false,
        generatedAt: new Date().toISOString(),
        reason: 'Source protocol schema has not been applied in this environment.',
        migration: 'migrations/20260501193000_source_respecting_llm.sql',
      })
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to load source protocol overview' },
      { status: 500 }
    )
  }
}
