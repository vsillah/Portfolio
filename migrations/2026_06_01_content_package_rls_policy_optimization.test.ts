import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_PATH = path.join(
  process.cwd(),
  'migrations',
  '2026_06_01_content_package_rls_policy_optimization.sql',
)

const POLICY_TABLES = [
  'content_frameworks',
  'social_idea_intakes',
  'content_packages',
  'content_package_outputs',
]

function policyBlockFor(sql: string, table: string) {
  const nextPolicyIndex = sql.indexOf('\nDROP POLICY IF EXISTS', sql.indexOf(`public.${table}`) + 1)
  const blockEnd = nextPolicyIndex === -1 ? sql.length : nextPolicyIndex
  return sql.slice(sql.indexOf(`public.${table}`), blockEnd)
}

describe('content package RLS policy optimization migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')

  it('recreates every content package admin policy as authenticated-only admin CRUD', () => {
    for (const table of POLICY_TABLES) {
      const block = policyBlockFor(sql, table)

      expect(sql).toContain(`DROP POLICY IF EXISTS "Admins can manage ${table}" ON public.${table};`)
      expect(block).toContain(`CREATE POLICY "Admins can manage ${table}"`)
      expect(block).toContain(`ON public.${table} FOR ALL TO authenticated`)
      expect(block).toContain("role = 'admin'")
      expect(block).toMatch(/USING\s*\(EXISTS\s*\(/)
      expect(block).toMatch(/WITH CHECK\s*\(EXISTS\s*\(/)
    }
  })

  it('wraps auth.uid in SELECT for each USING and WITH CHECK clause', () => {
    const optimizedAuthUidChecks = sql.match(/id = \(SELECT auth\.uid\(\)\) AND role = 'admin'/g) ?? []
    const directAuthUidChecks = sql.match(/id = auth\.uid\(\)/g) ?? []

    expect(optimizedAuthUidChecks).toHaveLength(POLICY_TABLES.length * 2)
    expect(directAuthUidChecks).toHaveLength(0)
  })
})
