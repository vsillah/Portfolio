import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(path.join(process.cwd(), 'supabase/migrations/20261101145513_bind_dark_castle_youtube_copy_review.sql'), 'utf8')

describe('atomic Dark Castle copy packet migration', () => {
  it('uses invoker rights and service-role-only execution', () => {
    expect(sql).toContain('SECURITY INVOKER')
    expect(sql).toContain('FROM PUBLIC, anon, authenticated')
    expect(sql).toContain('TO service_role')
  })

  it('checks exact immutable artifact and canonical receipt identities before the first write', () => {
    const firstWrite = sql.indexOf('UPDATE public.social_content_queue')
    for (const required of ['2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36',
      '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0',
      'youtube-description:dark-castle:sha256:224f7d07a4d55a9d',
      'youtube-description-evidence-reconciliation:fnv1a:07f944bb',
      'human-qa:dark-castle-youtube-master:thumbnail-selection:20261030:v1',
      "ARRAY['source', 'voice', 'framework', 'privacy', 'visual', 'challenger']",
      'v_item.updated_at IS DISTINCT FROM p_expected_content_updated_at',
      'v_receipt ->> \'receipt_id\' = ANY(v_seen_receipt_ids)']) {
      expect(sql.indexOf(required)).toBeGreaterThan(-1)
      expect(sql.indexOf(required)).toBeLessThan(firstWrite)
    }
  })

  it('writes media and packet in one function with exception rollback and no decision insert', () => {
    expect(sql).toContain('SET video_url = v_media_binding')
    expect(sql).toContain("'copy_review_candidate_projection', v_projection")
    expect(sql).toContain('INSERT INTO public.agent_approvals')
    expect(sql).toContain('INSERT INTO public.agent_work_items')
    expect(sql).not.toContain('INSERT INTO public.social_content_decision_receipts')
    expect(sql).not.toContain('EXCEPTION WHEN')
  })
})
