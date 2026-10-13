import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261013023106_social_content_decision_receipts.sql',
)

describe('Social Content decision receipt migration contract', () => {
  const sql = readFileSync(migrationPath, 'utf8')

  it('creates an append-only receipt table with a deterministic idempotency key', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.social_content_decision_receipts')
    expect(sql).toContain('idempotency_key TEXT NOT NULL UNIQUE')
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.social_content_decision_receipts')
    expect(sql).toContain("RAISE EXCEPTION 'social_content_decision_receipts are immutable'")
  })

  it('restricts the command and receipt table to the server-side service role', () => {
    expect(sql).toContain('ALTER TABLE public.social_content_decision_receipts ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('GRANT SELECT, INSERT ON TABLE public.social_content_decision_receipts TO service_role')
    expect(sql).toContain('SECURITY INVOKER')
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_social_content_decision[\s\S]+TO service_role;/)
  })

  it('requires every version-bound review receipt in the database transaction', () => {
    for (const key of ['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']) {
      expect(sql).toContain(`'${key}'`)
    }
    expect(sql).toContain("v_packet ->> 'content_updated_at'")
    expect(sql).toContain("v_receipts -> v_key ->> 'content_updated_at'")
    expect(sql).toContain("v_approval.approval_type <> 'social_content_internal_review'")
  })

  it('touches only internal review tables and never publication or provider surfaces', () => {
    expect(sql).not.toMatch(/social_content_publishes/i)
    expect(sql).not.toMatch(/social_content_config/i)
    expect(sql).not.toMatch(/storage\.objects/i)
    expect(sql).not.toMatch(/net\.http|http_post|pg_net/i)
    expect(sql).not.toMatch(/slack|linkedin|youtube|instagram|tiktok/i)
  })
})
