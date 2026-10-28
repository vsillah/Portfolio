import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261028215442_prepare_social_content_copy_review_packet_trigger_bound.sql'), 'utf8')

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

  it('accounts for the queue BEFORE UPDATE trigger instead of binding to the old version', () => {
    const originalVersion = '2026-10-28T12:00:00.000Z'
    const transactionNow = '2026-10-28T12:01:00.000Z'
    const triggerProducedVersion = (_assignedVersion: string) => transactionNow
    expect(triggerProducedVersion(originalVersion)).not.toBe(originalVersion)
    expect(triggerProducedVersion(transactionNow)).toBe(transactionNow)

    const firstUpdate = sql.indexOf('UPDATE public.social_content_queue SET updated_at = now()')
    const packetBuild = sql.indexOf('v_packet := jsonb_build_object(')
    const finalUpdate = sql.indexOf('SET rag_context = COALESCE(rag_context')
    expect(firstUpdate).toBeGreaterThan(0)
    expect(firstUpdate).toBeLessThan(packetBuild)
    expect(packetBuild).toBeLessThan(finalUpdate)
    expect(sql).toContain('RETURNING updated_at INTO v_prepared_version')
    expect(sql).toContain('v_prepared_version <= v_evidence_version')
    expect(sql).toContain("'content_updated_at', v_prepared_version")
    expect(sql).toContain('v_item.updated_at IS DISTINCT FROM v_prepared_version')
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
    expect(sql).toContain('v_source_receipts := v_receipts')
    expect(sql).toContain("'source_receipts', v_source_receipts")
    expect(sql).toContain("'source_content_updated_at', v_evidence_version")
    expect(sql).toContain("'candidate_projection', v_projection")
    expect(sql).toContain("'external_execution', false")
    expect(sql).not.toMatch(/net\.http|http_post|storage\.objects|social_content_publishes/i)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.prepare_social_content_copy_review')
    expect(sql).toContain('TO service_role')
  })
})
