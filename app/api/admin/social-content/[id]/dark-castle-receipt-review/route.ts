import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'
import {
  buildDarkCastleReceiptReviewPackets,
  DARK_CASTLE_RECEIPT_CONTENT_VERSION,
  DARK_CASTLE_RECEIPT_UPDATED_AT,
  type ReceiptReviewRecord,
} from '@/lib/dark-castle-receipt-review-packets'
import artifact from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/receipts.json'
import selection from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-selection-receipt-v1.json'
import { buildApprovedDarkCastleReceipts } from '@/lib/dark-castle-prerequisite-recorder'

export const dynamic = 'force-dynamic'
const fixtureName = 'dark_castle_receipt_packets_v1'
const root = 'artifacts/human-qa/dark-castle-youtube-master-2026-10-29'
const assetRoot = 'public/review-assets/social-content/dark-castle-youtube-master-2026-10-29'
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex')

async function fileHashes() {
  const [script, storyboard, master, thumbnail] = await Promise.all([
    readFile(path.join(process.cwd(), root, 'script.md')),
    readFile(path.join(process.cwd(), root, 'storyboard.json')),
    readFile(path.join(process.cwd(), assetRoot, 'dark-castle-youtube-master.mp4')),
    readFile(path.join(process.cwd(), assetRoot, '03-accidental-success-v2.png')),
  ])
  return { scriptSha256: hash(script), storyboardSha256: hash(storyboard), masterSha256: hash(master), thumbnailSha256: hash(thumbnail) }
}

// Only the local, non-production browser fixture uses this public-safe projection.
// It contains the exact known bindings and no fabricated prerequisite receipts.
const qaItem: ReceiptReviewRecord = {
  id: DARK_CASTLE_COPY_CONTENT_ID, updated_at: DARK_CASTLE_RECEIPT_UPDATED_AT,
  platform: 'youtube', status: 'draft',
  description_sha256: '224f7d07a4d55a9de3d22028ce81a76312fe64e52f06bcf38c440da89a90817d',
  rag_context: {
    content_version: DARK_CASTLE_RECEIPT_CONTENT_VERSION,
    source_lineage: [
      'https://www.youtube.com/watch?v=K9vKzNJAp3U',
      'https://link.springer.com/article/10.1007/s10758-026-10032-5',
      'https://doc.fide.com/docs/DOC/2026_1FC/CM1-202605.pdf',
    ],
    youtube_description_receipt: {
      receipt_id: artifact.descriptionReceipt, content_version: DARK_CASTLE_RECEIPT_CONTENT_VERSION,
      description_sha256: '224f7d07a4d55a9de3d22028ce81a76312fe64e52f06bcf38c440da89a90817d',
      evidence_input_fingerprint: 'fnv1a:07f944bb',
    },
    description_evidence_reconciliation_receipt: {
      receipt_id: artifact.evidenceReceipt.identity, content_version: DARK_CASTLE_RECEIPT_CONTENT_VERSION,
      status: 'passed', evidence_input_fingerprint: 'fnv1a:07f944bb',
    },
  },
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  if (params.id !== DARK_CASTLE_COPY_CONTENT_ID) return NextResponse.json({ error: 'Unrelated Social Content record.' }, { status: 404 })
  const fixture = process.env.NODE_ENV !== 'production' && request.nextUrl.searchParams.get('qa_fixture') === fixtureName
  if (!fixture) {
    const auth = await verifyAdmin(request)
    if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  try {
    const hashes = await fileHashes()
    let item: ReceiptReviewRecord | null = qaItem
    if (!fixture) {
      const { data, error } = await supabaseAdmin.from('social_content_queue')
        .select('id, updated_at, platform, status, rag_context, youtube_description')
        .eq('id', params.id).maybeSingle()
      if (error) return NextResponse.json({ error: 'Unable to inspect the canonical record.' }, { status: 503 })
      item = data ? {
        id: data.id, updated_at: data.updated_at, platform: data.platform, status: data.status,
        rag_context: data.rag_context,
        description_sha256: typeof data.youtube_description === 'string' ? createHash('sha256').update(data.youtube_description).digest('hex') : null,
      } : null
    }
    const packets = buildDarkCastleReceiptReviewPackets({ item, artifact, selection, ...hashes })
    const receipts = item?.rag_context && typeof item.rag_context === 'object' && !Array.isArray(item.rag_context)
      ? (item.rag_context as Record<string, unknown>).copy_review_evidence_receipts : null
    let persisted: { receipt_id: string; kind: string; packet_id: string; evidence_fingerprint: string; projected_content_updated_at: string; receipt: unknown }[] = []
    let persistenceError = false
    if (!fixture) {
      const result = await supabaseAdmin.from('dark_castle_prerequisite_receipts')
        .select('receipt_id,kind,packet_id,evidence_fingerprint,projected_content_updated_at,receipt')
        .eq('social_content_id', params.id)
      persistenceError = Boolean(result.error)
      persisted = result.data ?? []
    }
    const bundle = receipts && typeof receipts === 'object' && !Array.isArray(receipts)
      ? receipts as Record<string, unknown> : null
    const recorded = !persistenceError && persisted.length === 6 && Boolean(bundle) && Object.keys(bundle ?? {}).length === 6
      && packets.every(packet => {
        const row = persisted.find(value => value.kind === packet.kind)
        const projected = bundle?.[packet.kind]
        return row?.packet_id === packet.packet_id && row.receipt_id === `${packet.packet_id}:approved`
          && row.evidence_fingerprint === packet.packet_id.split(':').at(-1)
          && row.projected_content_updated_at && Date.parse(row.projected_content_updated_at) === Date.parse(item?.updated_at ?? '')
          && projected && typeof projected === 'object' && !Array.isArray(projected)
          && (projected as Record<string, unknown>).receipt_id === row.receipt_id
          && isDeepStrictEqual(projected, row.receipt)
      })
    return NextResponse.json({ packets, fixture, record_verified: !fixture && Boolean(item),
      recorded, persisted_receipt_ids: recorded ? persisted.map(row => row.receipt_id) : [],
      persistence_error: persistenceError ? 'Receipt storage is unavailable; migration may be pending.' : null,
      can_record: !fixture && !persistenceError && !receipts && persisted.length === 0 && packets.every(packet => packet.blockers.length === 1
        && packet.blockers[0].includes('reviewer decision and persisted prerequisite receipt are missing')),
      external_execution: false })
  } catch {
    return NextResponse.json({ error: 'Local review artifacts could not be verified.' }, { status: 503 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (params.id !== DARK_CASTLE_COPY_CONTENT_ID) return NextResponse.json({ error: 'Unrelated Social Content record.' }, { status: 404 })
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status })
  let body: { approved_packet_ids?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid review request.' }, { status: 400 }) }
  try {
    const hashes = await fileHashes()
    const { data, error } = await supabaseAdmin.from('social_content_queue')
      .select('id, updated_at, platform, status, rag_context, youtube_description').eq('id', params.id).maybeSingle()
    if (error || !data) return NextResponse.json({ error: 'Canonical record unavailable.' }, { status: 503 })
    const item: ReceiptReviewRecord = { id: data.id, updated_at: data.updated_at, platform: data.platform,
      status: data.status, rag_context: data.rag_context,
      description_sha256: typeof data.youtube_description === 'string' ? hash(Buffer.from(data.youtube_description)) : null }
    const packets = buildDarkCastleReceiptReviewPackets({ item, artifact, selection, ...hashes })
    const receipts = buildApprovedDarkCastleReceipts({ packets, approvedPacketIds: body.approved_packet_ids,
      reviewerId: auth.user.id, hashes })
    const { data: result, error: writeError } = await supabaseAdmin.rpc('record_dark_castle_prerequisite_receipts', {
      p_social_content_id: params.id,
      p_source_content_updated_at: DARK_CASTLE_RECEIPT_UPDATED_AT,
      p_reviewer_id: auth.user.id,
      p_receipts: receipts,
    })
    if (writeError || !result) return NextResponse.json({ error: writeError?.message || 'Atomic receipt recording failed.' }, { status: 409 })
    return NextResponse.json({ result, external_execution: false })
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : 'Receipt recording failed.' }, { status: 409 })
  }
}
