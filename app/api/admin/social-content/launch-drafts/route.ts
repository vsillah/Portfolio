import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  AGENTIC_SOCIAL_LAUNCH_DRAFTS,
  buildAgenticSocialLaunchDraftRow,
  getAgenticSocialLaunchDraftByAssetId,
} from '@/lib/agentic-social-launch-drafts'

export const dynamic = 'force-dynamic'

type SeedRequestBody = {
  asset_ids?: string[]
}

type ExistingSeedRow = {
  id: string
  rag_context: Record<string, unknown> | null
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({})) as SeedRequestBody
    const requestedAssetIds = Array.isArray(body.asset_ids) && body.asset_ids.length > 0
      ? body.asset_ids
      : AGENTIC_SOCIAL_LAUNCH_DRAFTS.map((draft) => draft.assetId)

    const invalidAssetIds = requestedAssetIds.filter((assetId) => !getAgenticSocialLaunchDraftByAssetId(assetId))
    if (invalidAssetIds.length > 0) {
      return NextResponse.json({
        error: 'Unknown launch draft asset id',
        invalidAssetIds,
      }, { status: 400 })
    }

    const drafts = requestedAssetIds
      .map((assetId) => getAgenticSocialLaunchDraftByAssetId(assetId))
      .filter(Boolean) as typeof AGENTIC_SOCIAL_LAUNCH_DRAFTS

    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from('social_content_queue')
      .select('id, rag_context')
      .contains('rag_context', { source: 'agentic_sales_outreach_launch_draft' })

    if (existingError) {
      console.error('[launch-drafts] existing seed lookup failed:', existingError)
      return NextResponse.json({ error: 'Failed to check existing launch drafts' }, { status: 500 })
    }

    const existingByAssetId = new Map<string, string>()
    for (const row of (existingRows ?? []) as ExistingSeedRow[]) {
      const assetId = typeof row.rag_context?.launch_draft_asset_id === 'string'
        ? row.rag_context.launch_draft_asset_id
        : null
      if (assetId) existingByAssetId.set(assetId, row.id)
    }

    const draftsToInsert = drafts.filter((draft) => !existingByAssetId.has(draft.assetId))
    const rowsToInsert = draftsToInsert.map((draft) => buildAgenticSocialLaunchDraftRow(draft, auth.user.id))

    let insertedRows: Array<{ id: string; rag_context: Record<string, unknown> | null }> = []
    if (rowsToInsert.length > 0) {
      const { data, error } = await supabaseAdmin
        .from('social_content_queue')
        .insert(rowsToInsert)
        .select('id, rag_context')

      if (error) {
        console.error('[launch-drafts] social draft insert failed:', error)
        return NextResponse.json({ error: 'Failed to seed launch drafts' }, { status: 500 })
      }
      insertedRows = (data ?? []) as typeof insertedRows
    }

    const inserted = insertedRows.map((row) => ({
      id: row.id,
      assetId: typeof row.rag_context?.launch_draft_asset_id === 'string'
        ? row.rag_context.launch_draft_asset_id
        : null,
      href: `/admin/social-content/${row.id}`,
    }))

    const existing = drafts
      .filter((draft) => existingByAssetId.has(draft.assetId))
      .map((draft) => {
        const id = existingByAssetId.get(draft.assetId)!
        return {
          id,
          assetId: draft.assetId,
          href: `/admin/social-content/${id}`,
        }
      })

    return NextResponse.json({
      success: true,
      inserted,
      existing,
      summary: {
        requested: drafts.length,
        inserted: inserted.length,
        existing: existing.length,
      },
    })
  } catch (error) {
    console.error('[launch-drafts] seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
