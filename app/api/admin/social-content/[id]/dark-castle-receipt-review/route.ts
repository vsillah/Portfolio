import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
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
    return NextResponse.json({
      packets: buildDarkCastleReceiptReviewPackets({ item, artifact, selection, ...hashes }),
      fixture, record_verified: !fixture && Boolean(item), external_execution: false,
    })
  } catch {
    return NextResponse.json({ error: 'Local review artifacts could not be verified.' }, { status: 503 })
  }
}
