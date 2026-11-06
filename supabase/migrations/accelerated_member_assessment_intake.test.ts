import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  'supabase/migrations/20261106042915_bind_accelerated_member_assessment_intake.sql',
  'utf8',
)

describe('accelerated member assessment intake migration', () => {
  it('binds only the exact persisted member worksheet in one transaction', () => {
    expect(migration).toContain('FROM public.accelerated_member_worksheets')
    expect(migration).toContain('user_id = p_user_id')
    expect(migration).toContain('worksheet_id = p_worksheet_id')
    expect(migration).toContain('content_version = p_content_version')
    expect(migration).toContain('v_member_answers IS DISTINCT FROM p_answers')
    expect(migration).toContain('INSERT INTO public.accelerated_decision_file_intakes')
    expect(migration).toContain('INSERT INTO public.accelerated_decision_file_owners')
  })

  it('is service-role-only, invoker-scoped, and idempotent for exact replay', () => {
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO service_role')
    expect(migration).toContain('v_existing.payload_sha256 IS DISTINCT FROM p_payload_sha256')
    expect(migration).toContain('RETURN QUERY SELECT v_existing.id, true')
    expect(migration).toContain('does not grant client-project access')
  })
})
