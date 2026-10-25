import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261025103000_prepare_social_content_stage_review.sql',
), 'utf8')

describe('Social Content stage review preparation migration', () => {
  it('creates the run, approval, work item, and item binding transactionally', () => {
    expect(migration).toContain('prepare_social_content_stage_review')
    expect(migration).toContain('INSERT INTO public.agent_runs')
    expect(migration).toContain('INSERT INTO public.agent_approvals')
    expect(migration).toContain('INSERT INTO public.agent_work_items')
    expect(migration).toContain("jsonb_build_object('mobile_decision_review', v_packet)")
  })

  it('binds preparation to the latest approved prior-stage receipt', () => {
    expect(migration).toContain("AND decision = 'approve'")
    expect(migration).toContain("AND next_internal_gate = p_current_gate")
    expect(migration).toContain("latest_internal_decision_receipt_id")
    expect(migration).toContain("ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']")
  })

  it('serializes idempotent retries and fails closed on stale versions', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('Social Content stage preparation is stale')
    expect(migration).toContain('Social Content current gate does not match requested stage')
    expect(migration).toContain("p_current_gate NOT IN ('asset_packet', 'privacy')")
  })

  it('does not add an external execution path', () => {
    expect(migration).not.toMatch(/social_content_publishes|storage\.objects|net\.http|http_post|pg_net/i)
    expect(migration).not.toMatch(/linkedin|youtube|instagram|facebook|tiktok|slack/i)
    expect(migration).toContain("'external_execution', false")
  })
})
