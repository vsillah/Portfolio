import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  buildAgenticSocialLaunchDraftRow,
  getAgenticSocialLaunchDraftByAssetId,
} from '@/lib/agentic-social-launch-drafts'
import { getAgenticContentReviewPacketsForSurface } from '@/lib/agentic-content-review-packets'
import { approveSocialContentItem, SocialContentApprovalError } from '@/lib/social-content-approval'

export const dynamic = 'force-dynamic'

type LaunchApprovalRequestBody = {
  asset_ids?: string[]
}

type ExistingLaunchRow = {
  id: string
  status?: string | null
  rag_context: Record<string, unknown> | null
}

type LaunchApprovalLink = {
  id: string
  assetId: string | null
  href: string
}

type LaunchApprovalSuccess = LaunchApprovalLink & {
  status: string
  productionWorkItemCount: number
  publishTriggered: boolean
}

type LaunchApprovalFailure = LaunchApprovalLink & {
  status: string | null
  error: unknown
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function rowAssetId(row: ExistingLaunchRow) {
  return typeof row.rag_context?.launch_draft_asset_id === 'string'
    ? row.rag_context.launch_draft_asset_id
    : null
}

function rowLink(row: ExistingLaunchRow) {
  return {
    id: row.id,
    assetId: rowAssetId(row),
    href: `/admin/social-content/${row.id}`,
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const admin = supabaseAdmin
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await request.json().catch(() => ({})) as LaunchApprovalRequestBody
    const eligibleAssetIds = getAgenticContentReviewPacketsForSurface('social')
      .map((packet) => packet.assetId)
      .filter((assetId) => Boolean(getAgenticSocialLaunchDraftByAssetId(assetId)))
    const requestedAssetIds = stringArray(body.asset_ids).length > 0
      ? stringArray(body.asset_ids)
      : eligibleAssetIds

    const invalidAssetIds = requestedAssetIds.filter((assetId) => !eligibleAssetIds.includes(assetId))
    if (invalidAssetIds.length > 0) {
      return NextResponse.json({
        error: 'Unknown or non-approvable launch draft asset id',
        invalidAssetIds,
        eligibleAssetIds,
      }, { status: 400 })
    }

    const drafts = requestedAssetIds.map((assetId) => getAgenticSocialLaunchDraftByAssetId(assetId)!)

    const { data: existingRows, error: existingError } = await admin
      .from('social_content_queue')
      .select('id, status, rag_context')
      .contains('rag_context', { source: 'agentic_sales_outreach_launch_draft' })

    if (existingError) {
      console.error('[launch-approvals] existing launch draft lookup failed:', existingError)
      return NextResponse.json({ error: 'Failed to check existing launch drafts' }, { status: 500 })
    }

    const existingByAssetId = new Map<string, ExistingLaunchRow>()
    for (const row of (existingRows ?? []) as ExistingLaunchRow[]) {
      const assetId = rowAssetId(row)
      if (assetId) existingByAssetId.set(assetId, row)
    }

    const draftsToInsert = drafts.filter((draft) => !existingByAssetId.has(draft.assetId))
    const rowsToInsert = draftsToInsert.map((draft) => buildAgenticSocialLaunchDraftRow(draft, auth.user.id))

    let insertedRows: ExistingLaunchRow[] = []
    if (rowsToInsert.length > 0) {
      const { data, error } = await admin
        .from('social_content_queue')
        .insert(rowsToInsert)
        .select('id, status, rag_context')

      if (error) {
        console.error('[launch-approvals] launch draft insert failed:', error)
        return NextResponse.json({ error: 'Failed to seed launch drafts' }, { status: 500 })
      }
      insertedRows = (data ?? []) as ExistingLaunchRow[]
    }

    const rowsToApprove = [
      ...drafts
        .filter((draft) => existingByAssetId.has(draft.assetId))
        .map((draft) => existingByAssetId.get(draft.assetId)!),
      ...insertedRows,
    ]

    const approved: LaunchApprovalSuccess[] = []
    const failed: LaunchApprovalFailure[] = []
    for (const row of rowsToApprove) {
      try {
        const result = await approveSocialContentItem({
          admin,
          id: row.id,
          reviewedByUserId: auth.user.id,
        })
        approved.push({
          ...rowLink(row),
          status: result.item?.status ?? 'approved',
          productionWorkItemCount: result.production_work_items?.length ?? 0,
          publishTriggered: result.publish_triggered,
        })
      } catch (error) {
        const approvalError = error instanceof SocialContentApprovalError
          ? error
          : new SocialContentApprovalError(500, { error: 'Failed to approve launch draft' })
        failed.push({
          ...rowLink(row),
          status: row.status ?? null,
          error: approvalError.payload.error,
        })
      }
    }

    const success = failed.length === 0
    return NextResponse.json({
      success,
      inserted: insertedRows.map(rowLink),
      existing: drafts
        .filter((draft) => existingByAssetId.has(draft.assetId))
        .map((draft) => rowLink(existingByAssetId.get(draft.assetId)!)),
      approved,
      failed,
      summary: {
        requested: requestedAssetIds.length,
        inserted: insertedRows.length,
        existing: requestedAssetIds.length - insertedRows.length,
        approved: approved.length,
        failed: failed.length,
      },
      remainingExternalGates: [
        'schedule',
        'publish',
        'outbound_send',
        'visual_build',
        'provider_execution',
      ],
    }, { status: success ? 200 : 207 })
  } catch (error) {
    console.error('[launch-approvals] run failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
