import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATION_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260814041054_govern_social_comment_external_submission.sql',
)

const FOUNDATION_PATH = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260806163011_social_comment_inbox_foundation.sql',
)

const SEEDED_PLATFORMS = ['linkedin', 'youtube', 'instagram', 'facebook', 'x', 'tiktok']

type CapabilityContractRow = {
  capability_status: 'verified' | 'manual' | 'blocked' | 'unsupported'
  supports_reply_submission: boolean
  external_submission_enabled: boolean
}

function governedConstraintAccepts(row: CapabilityContractRow) {
  return (
    row.external_submission_enabled === false
    || (
      row.capability_status === 'verified'
      && row.supports_reply_submission === true
    )
  )
}

describe('social comment provider capability external submission migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8')
  const foundationSql = readFileSync(FOUNDATION_PATH, 'utf8')

  it('replaces only the blanket external submission check with a governed per-provider check', () => {
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS social_comment_provider_capabilities_external_submission_off',
    )
    expect(sql).toContain(
      'ADD CONSTRAINT social_comment_provider_capabilities_external_submission_governed',
    )
    expect(sql).toContain('external_submission_enabled = false')
    expect(sql).toContain("capability_status = 'verified'")
    expect(sql).toContain('supports_reply_submission = true')
  })

  it('does not update capability rows, provider config, RLS, grants, or policy posture', () => {
    expect(sql).not.toMatch(/\bINSERT\b/i)
    expect(sql).not.toMatch(/\bUPDATE\b/i)
    expect(sql).not.toMatch(/\bDELETE\b/i)
    expect(sql).not.toMatch(/\bCREATE\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bDROP\s+POLICY\b/i)
    expect(sql).not.toMatch(/\bENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i)
    expect(sql).not.toMatch(/\bDISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i)
    expect(sql).not.toMatch(/\bGRANT\b/i)
    expect(sql).not.toMatch(/\bREVOKE\b/i)
    expect(sql).not.toMatch(/\bsocial_content_config\b/i)
  })

  it('keeps every currently seeded capability row valid because all remain disabled', () => {
    for (const platform of SEEDED_PLATFORMS) {
      expect(foundationSql).toContain(`'${platform}'`)
    }

    for (const capabilityStatus of ['verified', 'manual', 'blocked', 'unsupported'] as const) {
      expect(governedConstraintAccepts({
        capability_status: capabilityStatus,
        supports_reply_submission: false,
        external_submission_enabled: false,
      })).toBe(true)
      expect(governedConstraintAccepts({
        capability_status: capabilityStatus,
        supports_reply_submission: true,
        external_submission_enabled: false,
      })).toBe(true)
    }
  })

  it('rejects true external submission when capability status is still manual', () => {
    expect(governedConstraintAccepts({
      capability_status: 'manual',
      supports_reply_submission: true,
      external_submission_enabled: true,
    })).toBe(false)
  })

  it('rejects true external submission when reply submission support is false', () => {
    expect(governedConstraintAccepts({
      capability_status: 'verified',
      supports_reply_submission: false,
      external_submission_enabled: true,
    })).toBe(false)
  })

  it('permits true external submission only for a verified provider with reply submission support', () => {
    expect(governedConstraintAccepts({
      capability_status: 'verified',
      supports_reply_submission: true,
      external_submission_enabled: true,
    })).toBe(true)
  })

  it('contains no hosted migration or provider side-effect command text', () => {
    expect(sql).not.toMatch(/\bsupabase\s+db\s+push\b/i)
    expect(sql).not.toMatch(/\bapply_migration\b/i)
    expect(sql).not.toMatch(/\bsupabase\.co\b/i)
    expect(sql).not.toMatch(/\byoutube\b/i)
    expect(sql).not.toMatch(/\bcomments\.insert\b/i)
  })
})
