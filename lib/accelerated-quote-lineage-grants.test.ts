import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const guardMigration = readFileSync(
  'supabase/migrations/20261105194500_accelerated_quote_lineage_guard.sql',
  'utf8',
)
const grantMigration = readFileSync(
  'supabase/migrations/20261105231500_restrict_accelerated_quote_lineage_guard.sql',
  'utf8',
)

describe('Accelerated quote lineage guard authorization', () => {
  it('keeps the trigger function SECURITY INVOKER', () => {
    expect(guardMigration).toMatch(
      /CREATE OR REPLACE FUNCTION public\.accelerated_quote_lineage_guard\(\) RETURNS trigger[\s\S]*?SECURITY INVOKER/,
    )
  })

  it('removes inherited execution and restores only service_role', () => {
    expect(grantMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.accelerated_quote_lineage_guard\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(grantMigration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.accelerated_quote_lineage_guard\(\)[\s\S]*?TO service_role;/,
    )
    expect(grantMigration).not.toMatch(/GRANT EXECUTE[\s\S]*?TO (?:PUBLIC|anon|authenticated);/)
  })
})
