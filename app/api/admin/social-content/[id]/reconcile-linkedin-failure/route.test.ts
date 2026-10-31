import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { releaseFixture, releaseStore, releaseVersion } from '@/lib/social-release-safety.test-fixtures'
import { socialReleaseFingerprint } from '@/lib/social-release-evidence'

const mocks = vi.hoisted(() => ({ from: vi.fn(), readRecoveryItems: vi.fn(), verifyAdmin: vi.fn(), isAuthError: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/social-schedule-recovery', () => ({ createSupabaseSocialScheduleRecoveryRepository: () => ({
  readRecoveryItems: mocks.readRecoveryItems,
}) }))

import { POST } from './route'

function request(version = releaseVersion) {
  return new NextRequest('http://localhost/api/admin/social-content/social-1/reconcile-linkedin-failure', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expected_updated_at: version, work_item_id: 'work-1' }),
  })
}

describe('historical LinkedIn failure reconciliation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } }); mocks.isAuthError.mockReturnValue(false) })

  function setup() {
    const item = releaseFixture()
    item.status = 'scheduled'
    item.scheduled_for = '2026-10-30T20:30:00.000Z'
    item.image_url = '/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png'
    item.rag_context.platform_submission_gate = { status: 'uncertain', reconciliation_required: true,
      release_id: 'release-1', claimed_at: '2026-10-30T20:30:01.000Z', release_platforms: ['linkedin'],
      approved_at: '2026-10-30T19:00:00.000Z', approved_by: 'admin-1', platforms: ['linkedin'] }
    item.rag_context.platform_submission_gate.approved_fingerprint = socialReleaseFingerprint(item)
    const store = releaseStore(item)
    const error = 'LinkedIn image upload failed; approved media must not be dropped'
    mocks.from.mockImplementation(store.admin.from)
    mocks.readRecoveryItems.mockResolvedValue([{ id: 'work-1', status: 'queued',
      source_type: 'social_content_scheduled_publish_recovery', source_id: item.id,
      updated_at: '2026-10-30T20:31:00.000Z', metadata: { recovery_kind: 'publish_blocked',
        scheduled_for: item.scheduled_for, provider_failures: { linkedin: error } } }])
    return { store, error }
  }

  it('marks only the pending row failed and binds the original error without a provider call', async () => {
    const { store, error } = setup()
    const response = await POST(request(), { params: { id: 'social-1' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ reconciled: true, provider_error: error,
      side_effects: { provider_call: false, publish: false } })
    expect(store.tables.social_content_publishes).toHaveLength(1)
    expect(store.publish()).toMatchObject({ status: 'failed', error_message: error })
    expect(store.item().rag_context.platform_submission_gate).toMatchObject({ status: 'approved',
      deterministic_failure: { publish_row_id: 'publish-1', release_id: 'release-1', error } })
  })

  it('rejects a stale content version without changing the row', async () => {
    const { store } = setup()
    const response = await POST(request('old-version'), { params: { id: 'social-1' } })
    expect(response.status).toBe(409)
    expect(store.publish().status).toBe('pending')
  })
})
