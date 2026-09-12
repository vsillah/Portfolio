import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ work: vi.fn(), sync: vi.fn() }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: mocks.work }))
vi.mock('@/lib/social-content-calendar-linkage', () => ({ syncCampaignCalendarForSocialContent: mocks.sync }))
import { approveSocialContentItem } from './social-content-approval'
import { releaseFixture, releaseStore } from './social-release-safety.test-fixtures'

beforeEach(() => vi.clearAllMocks())
const run = (store: ReturnType<typeof releaseStore>) => approveSocialContentItem({ admin: store.admin as never, id: 'social-1', reviewedByUserId: 'admin' })
describe('all-row copy approval release fence', () => {
  it.each(['submitting', 'uncertain', 'submitted'])('rejects non-calendar %s releases', async status => {
    const item = releaseFixture(); item.status = 'draft'; item.rag_context.platform_submission_gate.status = status
    const store = releaseStore(item)
    await expect(run(store)).rejects.toMatchObject({ status: 409 })
    expect(store.writes).toHaveLength(0); expect(mocks.work).not.toHaveBeenCalled()
  })
  it('does not reset a legacy in-flight child row without gate JSON', async () => {
    const item = releaseFixture(); item.status = 'draft'; delete item.rag_context.platform_submission_gate
    const store = releaseStore(item); store.publish().status = 'publishing'
    await expect(run(store)).rejects.toMatchObject({ status: 409 })
    expect(store.writes).toHaveLength(0); expect(store.publish().status).toBe('publishing')
  })
  it('uses CAS for non-calendar drafts and preserves an existing child row on upsert', async () => {
    const item = releaseFixture(); item.status = 'draft'; delete item.rag_context.platform_submission_gate
    const store = releaseStore(item); store.publish().status = 'failed'
    await run(store)
    expect(store.item().status).toBe('approved')
    expect(store.publish().status).toBe('failed')
  })
  it('loses cleanly when release/edit changes the row before approval write', async () => {
    const item = releaseFixture(); item.status = 'draft'
    const store = releaseStore(item); store.controls.beforeWrite = () => { store.item().updated_at = 'newer' }
    await expect(run(store)).rejects.toMatchObject({ status: 409 })
    expect(store.writes).toHaveLength(0); expect(store.publish().status).toBe('pending')
  })
})
