import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261031234703_prepare_visual_review_asset_packet.sql'), 'utf8')
const visual = sql.slice(sql.indexOf("IF p_current_gate = 'visual_review' THEN"), sql.indexOf('-- The row trigger determines'))

describe('visual review to asset packet migration', () => {
  it('requires the exact approved copy decision before preparing the visual review', () => {
    expect(sql).toContain("p_current_gate NOT IN ('visual_review', 'asset_packet', 'privacy')")
    expect(sql).toContain("id::TEXT = v_item.rag_context ->> 'latest_internal_decision_receipt_id'")
    expect(sql).toContain("AND social_content_id = p_social_content_id")
    expect(sql).toContain("AND decision = 'approve'")
    expect(sql).toContain("AND next_internal_gate = p_current_gate")
    expect(sql).toContain("v_prior_receipt.command_name IS DISTINCT FROM 'approve_copy'")
    expect(sql).toContain("WHEN 'visual_review' THEN 'asset_packet'")
  })

  it('fails closed on stale, pending, duplicate, or ambiguous versioned receipts', () => {
    expect(sql).toContain("LOWER(COALESCE(v_receipt ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')")
    expect(sql).toContain("(v_receipt ->> 'content_updated_at')::TIMESTAMPTZ IS DISTINCT FROM v_source_version")
    expect(sql).toContain("v_receipt ->> 'receipt_id' = ANY(v_seen_receipt_ids)")
    expect(sql).toContain('Existing review packet identity or version mismatch')
    expect(sql).toContain('Existing review packet is stale')
  })

  it('binds the approved visual receipt to current copy, CTA, path, hash, lead magnet, and artifact lineage', () => {
    for (const field of ['post_text', 'cta_text', 'cta_url', 'image_url', 'visual_sha256']) {
      expect(visual).toContain(field)
    }
    expect(visual).toContain("v_candidate_projection IS DISTINCT FROM v_item.rag_context -> 'copy_review_candidate_projection'")
    expect(visual).toContain("v_asset_hash IS DISTINCT FROM v_item.rag_context ->> 'approved_visual_sha256'")
    expect(visual).toContain("v_receipts -> 'visual' ->> 'receipt_id'")
    expect(visual).toContain("v_lead_magnet ->> 'receipt_id' IS DISTINCT FROM v_candidate_projection ->> 'lead_magnet_receipt_id'")
    expect(visual).toContain("v_candidate_projection -> 'artifact_evidence_manifest' IS DISTINCT FROM v_item.rag_context -> 'artifact_evidence_manifest'")
    expect(sql).toContain("'prior_decision_receipt_id', v_prior_receipt.id")
    expect(sql).toContain("'source_receipts', v_prior_receipt.receipt_bundle")
  })

  it('replays an exact live packet and keeps execution service-role-only', () => {
    expect(sql).toContain("p_expected_content_updated_at IS DISTINCT FROM (v_packet ->> 'prepared_from_content_updated_at')::TIMESTAMPTZ")
    expect(sql).toContain("'idempotent_replay', true")
    expect(sql).toContain("'external_execution', false")
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.prepare_social_content_stage_review')
    expect(sql).toContain('TO service_role')
    expect(sql).not.toMatch(/\b(?:INSERT INTO|UPDATE|DELETE FROM) public\.(?:social_content_decision_receipts|social_content_publishes|storage\.objects)\b/i)
    expect(sql).not.toMatch(/net\.http|http_post|pg_net|\b(?:publish|schedule|upload|render)_social_content\s*\(/i)
  })
})
