import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20261013150000_social_content_canonical_decision_commands.sql',
), 'utf8')
const runtimeRoute = readFileSync(path.join(
  process.cwd(),
  'app',
  'api',
  'admin',
  'social-content',
  '[id]',
  'decision',
  'route.ts',
), 'utf8')

describe('canonical Social Content stage decision migration', () => {
  it('records the stage command and immutable receipt in one transaction function', () => {
    expect(migration).toContain('record_social_content_stage_decision')
    expect(migration).toContain('command_name')
    expect(migration).toContain('INSERT INTO public.social_content_decision_receipts')
    expect(migration).toContain('Canonical Social Content command does not match the packet stage')
  })

  it('uses stage-specific canonical mutations instead of a global generic status transition', () => {
    expect(migration).toContain("v_gate IN ('copy', 'copy_review')")
    expect(migration).toContain("v_gate IN ('visual_review', 'visual_assets', 'asset_packet', 'privacy')")
    expect(migration).toContain("v_gate IN ('platform_submission', 'submit')")
    expect(migration).toContain("'submit_after_approval', false")
  })

  it('keeps evidence and route bindings fail-closed', () => {
    expect(migration).toContain("ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']")
    expect(migration).toContain('Social Content review packet is stale')
    expect(migration).toContain('Decision Queue work item is not bound to this review packet')
  })

  it('is migration-first safe by preserving the deployed legacy RPC grant', () => {
    expect(migration).not.toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+public\.record_social_content_decision/i,
    )
    expect(migration).toContain('Expand phase: keep the pre-deploy receipt RPC and its existing grants intact.')
  })

  it('moves the application runtime exclusively to the new canonical command', () => {
    expect(runtimeRoute).toContain("'record_social_content_stage_decision'")
    expect(runtimeRoute).not.toContain("'record_social_content_decision'")
  })

  it('keeps calendar, discovery, engagement, outreach, and provider release outside the command', () => {
    expect(migration).not.toMatch(/campaign_calendar|topic_backlog|engagement|outreach/i)
    expect(migration).not.toMatch(/social_content_publishes|storage\.objects|net\.http|http_post|pg_net/i)
    expect(migration).not.toMatch(/linkedin|youtube|instagram|facebook|tiktok|slack/i)
  })
})
