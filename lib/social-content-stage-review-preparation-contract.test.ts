import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261025103000_prepare_social_content_stage_review.sql',
), 'utf8')

describe('Social Content stage preparation fail-closed contract', () => {
  it('rejects a blank idempotency key before it takes the advisory lock', () => {
    const blank = migration.indexOf("NULLIF(BTRIM(p_idempotency_key), '') IS NULL")
    const required = migration.indexOf("RAISE EXCEPTION 'Review preparation idempotency key is required'")
    const lock = migration.indexOf('pg_advisory_xact_lock')

    expect(blank).toBeGreaterThan(-1)
    expect(required).toBeGreaterThan(blank)
    expect(lock).toBeGreaterThan(required)
  })

  it('replays an existing work item before locking or updating the content row', () => {
    const replay = migration.indexOf("'idempotent_replay', true")
    const rowLock = migration.indexOf('FOR UPDATE')
    const update = migration.indexOf('UPDATE public.social_content_queue')

    expect(replay).toBeGreaterThan(-1)
    expect(rowLock).toBeGreaterThan(replay)
    expect(update).toBeGreaterThan(rowLock)
    expect(migration).toContain("'work_item_id', v_existing_work.id")
    expect(migration).toContain("'approval_id', v_existing_work.approval_id")
    expect(migration).toContain("'run_id', v_existing_work.active_run_id")
  })

  it('advances only the two preparable gates and rewrites inherited receipt timestamps', () => {
    expect(migration).toContain("WHEN 'asset_packet' THEN 'privacy'")
    expect(migration).toContain("WHEN 'privacy' THEN 'platform_submission'")
    expect(migration).not.toMatch(/WHEN '(copy|copy_review|visual_review|visual_assets|submit|platform_submission)'/)
    expect(migration).toContain("jsonb_set(v_receipts, ARRAY[v_key, 'content_updated_at'], to_jsonb(v_now), true)")
  })

  it('requires a non-blank prior receipt id and an approved, passed, or complete status', () => {
    expect(migration).toContain("NULLIF(BTRIM(v_receipts -> v_key ->> 'receipt_id'), '') IS NULL")
    expect(migration).toContain("LOWER(COALESCE(v_receipts -> v_key ->> 'status', '')) NOT IN ('approved', 'passed', 'complete')")
    expect(migration).toContain("RAISE EXCEPTION 'Prior-stage % receipt is missing or not approved', v_key")
    expect(migration).toContain("jsonb_typeof(v_receipts) <> 'object'")
    expect(migration).toContain("RAISE EXCEPTION 'Prior-stage receipt bundle is missing'")
    expect(migration).toContain("RAISE EXCEPTION 'Approved prior-stage receipt is required'")
  })

  it('keeps execution on the service role and separates run and work-item keys', () => {
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).toContain('SET search_path = public, pg_temp')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.prepare_social_content_stage_review(UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.prepare_social_content_stage_review(UUID, TIMESTAMPTZ, TEXT, UUID, TEXT)')
    expect(migration).toContain('TO service_role')
    expect(migration).not.toMatch(/GRANT EXECUTE[\s\S]*TO (anon|authenticated|PUBLIC)/)
    expect(migration).toContain("p_idempotency_key || ':run'")
    expect(migration).toContain("'external_execution', false")
  })
})
