import { describe, expect, it } from 'vitest'
import artifact from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/receipts.json'
import selection from '@/artifacts/human-qa/dark-castle-youtube-master-2026-10-29/thumbnail-selection-receipt-v1.json'
import {
  buildDarkCastleReceiptReviewPackets,
  DARK_CASTLE_RECEIPT_CONTENT_VERSION,
  DARK_CASTLE_RECEIPT_UPDATED_AT,
  type ReceiptReviewRecord,
} from './dark-castle-receipt-review-packets'

const item: ReceiptReviewRecord = {
  id: artifact.canonicalRecord, updated_at: DARK_CASTLE_RECEIPT_UPDATED_AT,
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

const hashes = {
  scriptSha256: artifact.finalMediaReceipt.scriptSha256,
  storyboardSha256: artifact.finalMediaReceipt.storyboardSha256,
  masterSha256: artifact.finalMediaReceipt.sha256,
  thumbnailSha256: selection.selected_asset_sha256,
}
const build = (overrides: Partial<Parameters<typeof buildDarkCastleReceiptReviewPackets>[0]> = {}) =>
  buildDarkCastleReceiptReviewPackets({ item, artifact, selection, ...hashes, ...overrides })

describe('Dark Castle receipt review candidates', () => {
  it('creates six separate, deterministic, version-bound packets without receipt or decision identities', () => {
    const packets = build()
    expect(packets.map(packet => packet.kind)).toEqual(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'])
    expect(new Set(packets.map(packet => packet.packet_id)).size).toBe(6)
    expect(build()).toEqual(packets)
    for (const packet of packets) {
      expect(packet.content_version).toBe(DARK_CASTLE_RECEIPT_CONTENT_VERSION)
      expect(packet.content_updated_at).toBe(DARK_CASTLE_RECEIPT_UPDATED_AT)
      expect(packet.receipt_id).toBeNull()
      expect(packet.decision_recorded).toBe(false)
      expect(packet.external_execution).toBe(false)
      expect(packet.blockers).toContain(`${packet.kind} reviewer decision and persisted prerequisite receipt are missing.`)
    }
    expect(packets[0].evidence).not.toEqual(packets[1].evidence)
  })

  it('fails all packets closed when the record is absent, stale, or on another content version', () => {
    expect(build({ item: null }).every(packet => packet.blockers.some(blocker => /unavailable|changed/.test(blocker)))).toBe(true)
    expect(build({ item: { ...item, updated_at: '2026-10-28T00:00:00Z' } }).every(packet => packet.blockers.some(blocker => /changed after/.test(blocker)))).toBe(true)
    expect(build({ item: { ...item, updated_at: '2026-10-27T20:14:59.293830Z' } }).every(packet => packet.blockers.some(blocker => /changed after/.test(blocker)))).toBe(true)
    expect(build({ item: { ...item, updated_at: '2026-10-27 20:14:59.293829+00' } })[0].blockers).not.toContain('The persisted record changed after this packet snapshot.')
    expect(build({ item: { ...item, rag_context: { ...(item.rag_context as object), content_version: 'sha256:other' } } }).every(packet => packet.blockers.some(blocker => /Content version/.test(blocker)))).toBe(true)
  })

  it('fails on mismatched source, description, media, script, or visual lineage', () => {
    const noSources = { ...item, rag_context: { ...(item.rag_context as object), source_lineage: [] } }
    expect(build({ item: noSources })[0].blockers).toContain('Source lineage count does not match the reconciled evidence.')
    const wrongDescription = { ...item, description_sha256: 'other' }
    expect(build({ item: wrongDescription })[0].blockers).toContain('Saved description and its receipt are not exactly bound.')
    expect(build({ masterSha256: 'other' })[0].blockers).toContain('Approved master or Direction C binding is missing or mismatched.')
    expect(build({ scriptSha256: 'other' })[2].blockers).toContain('Script or storyboard hash differs from the final master receipt.')
    expect(build({ selection: { ...selection, selected_direction: 'B' } })[4].blockers).toContain('Approved master or Direction C binding is missing or mismatched.')
  })

  it('blocks duplicate source URLs and existing duplicate prerequisite identities', () => {
    const context = item.rag_context as Record<string, unknown>
    const urls = context.source_lineage as string[]
    const duplicateSources = { ...item, rag_context: { ...context, source_lineage: [urls[0], urls[0], urls[2]] } }
    expect(build({ item: duplicateSources })[0].blockers).toContain('Source lineage contains a duplicate URL.')
    const duplicateReceipts = { ...item, rag_context: { ...context, copy_review_evidence_receipts: {
      source: { receipt_id: 'existing-id' }, voice: { receipt_id: 'existing-id' },
    } } }
    const packets = build({ item: duplicateReceipts })
    expect(packets[0].blockers).toContain('Existing prerequisite receipt identities are duplicated.')
    expect(packets[1].blockers).toContain('voice prerequisite receipt already exists; inspect the persisted receipt rather than preparing a duplicate.')
  })
})
