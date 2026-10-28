import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261028213330_prepare_social_content_copy_review_packet.sql'), 'utf8')

describe('initial Social Content copy-review transaction', () => {
  it('creates one version-bound canonical packet and reuses its pending binding on retry', () => {
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("v_packet ->> 'content_updated_at')::TIMESTAMPTZ = v_item.updated_at")
    expect(sql).toContain("a.status = 'pending'")
    expect(sql).toContain("'idempotent_replay', true")
    expect(sql).toContain('INSERT INTO public.agent_runs')
    expect(sql).toContain('INSERT INTO public.agent_approvals')
    expect(sql).toContain('INSERT INTO public.agent_work_items')
    expect(sql).toContain("'current_gate', 'copy_review'")
  })

  it('rejects missing, unapproved, and mismatched canonical receipt identities', () => {
    expect(sql).toContain("v_item.rag_context -> 'copy_review_evidence_receipts'")
    expect(sql).toContain("ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']")
    expect(sql).toContain("v_receipt ->> 'receipt_id'")
    expect(sql).toContain('receipt identity is missing')
    expect(sql).toContain('receipt is not approved')
    expect(sql).toContain('receipt version mismatch')
    expect(sql).toContain('Ambiguous copy-review receipt identity')
    expect(sql).toContain('v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at')
    expect(sql).not.toMatch(/receipt_id'\s*,\s*(?:gen_random_uuid|uuid_generate_v4)/i)
  })

  it('requires one exact calendar identity and preserves unrelated metadata', () => {
    expect(sql).toContain('WHERE social_content_id = p_social_content_id')
    expect(sql).toContain('IF v_calendar_count <> 1')
    expect(sql).toContain("COALESCE(metadata -> 'social_content_lifecycle', '{}'::JSONB)")
    expect(sql).toContain("COALESCE(metadata #> '{social_content_lifecycle,copy_review}', '{}'::JSONB)")
    expect(sql).toContain('WHERE id = v_calendar.id')
    expect(sql).not.toMatch(/UPDATE public\.social_content_calendar_items\s+SET\s+(?:due_status|scheduled_for|authorization_status)/i)
  })

  it('copies the full receipt and candidate projections without an external side effect', () => {
    expect(sql).toContain("'receipts', v_receipts")
    expect(sql).toContain("'candidate_projection', v_projection")
    expect(sql).toContain("'external_execution', false")
    expect(sql).not.toMatch(/net\.http|http_post|storage\.objects|social_content_publishes/i)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.prepare_social_content_copy_review')
    expect(sql).toContain('TO service_role')
  })
})
