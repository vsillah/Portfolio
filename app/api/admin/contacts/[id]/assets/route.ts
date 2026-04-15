/**
 * DELETE /api/admin/contacts/[id]/assets
 * Deletes one or more assets (gamma_reports, video_generation_jobs, value_reports)
 * for a given contact. Uses soft-delete (deleted_at) for videos, hard-delete for others.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const VALID_ASSET_TYPES = ['gamma_report', 'video', 'value_report'] as const
type AssetType = (typeof VALID_ASSET_TYPES)[number]

const TABLE_MAP: Record<AssetType, string> = {
  gamma_report: 'gamma_reports',
  video: 'video_generation_jobs',
  value_report: 'value_reports',
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const contactId = parseInt(params.id, 10)
  if (isNaN(contactId)) {
    return NextResponse.json({ error: 'Invalid contact ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body || !body.assetType || !body.assetId) {
    return NextResponse.json(
      { error: 'Missing required fields: assetType, assetId' },
      { status: 400 }
    )
  }

  const { assetType, assetId } = body as { assetType: string; assetId: string }

  if (!VALID_ASSET_TYPES.includes(assetType as AssetType)) {
    return NextResponse.json(
      { error: `Invalid asset type. Must be one of: ${VALID_ASSET_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const table = TABLE_MAP[assetType as AssetType]

  if (assetType === 'video') {
    const { error } = await supabaseAdmin
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', assetId)
      .eq('contact_submission_id', contactId)

    if (error) {
      console.error(`[Asset delete] soft-delete video error:`, error.message)
      return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
    }
  } else {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq('id', assetId)
      .eq('contact_submission_id', contactId)

    if (error) {
      console.error(`[Asset delete] hard-delete ${assetType} error:`, error.message)
      return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, assetType, assetId })
}
