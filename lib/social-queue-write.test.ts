import { describe, expect, it } from 'vitest'
import { assertSocialQueueWritable, readSocialQueueForWrite, updateSocialQueueWithVersion } from './social-queue-write'
import { releaseStore } from './social-release-safety.test-fixtures'

describe('versioned preparation writers', () => {
  it.each(['claimed', 'submitting', 'publishing', 'uncertain', 'ambiguous', 'submitted'])('refuses %s before preparation', async status => {
    const store = releaseStore(); store.item().rag_context.platform_submission_gate.status = status
    await expect(readSocialQueueForWrite(store.admin, 'social-1')).rejects.toThrow('release')
    expect(store.writes).toHaveLength(0)
  })
  it.each([
    { status: 'scheduled' }, { status: 'publishing' }, { scheduled_for: '2026-09-09' },
    { published_at: '2026-09-08' }, { platform_post_id: 'legacy-post' },
  ])('locks legacy queue evidence without JSON: %j', async evidence => {
    const store = releaseStore(); delete store.item().rag_context.platform_submission_gate
    Object.assign(store.item(), evidence)
    await expect(readSocialQueueForWrite(store.admin, 'social-1')).rejects.toThrow()
    expect(store.writes).toHaveLength(0)
  })
  it.each([{ status: 'publishing' }, { status: 'published' }, { platform_post_id: 'remote-1' }])('locks legacy child publication evidence: %j', async evidence => {
    const store = releaseStore(); delete store.item().rag_context.platform_submission_gate
    Object.assign(store.publish(), evidence)
    await expect(readSocialQueueForWrite(store.admin, 'social-1')).rejects.toThrow('publication evidence')
    expect(store.writes).toHaveLength(0)
  })
  it('invalidates final approval and ignores incoming forged gate evidence', async () => {
    const store = releaseStore(), original = structuredClone(store.item())
    const result = await updateSocialQueueWithVersion(store.admin, original, { image_url: 'fixture/new.png', rag_context: {
      platform_submission_gate: { status: 'approved', approved_fingerprint: 'forged' }, other: 'preserved',
    } })
    expect(result.data.rag_context.platform_submission_gate).toMatchObject({ status: 'pending', approved_fingerprint: null })
    expect(result.data.rag_context.source_packet_path).toBe('fixture/source.md')
    expect(result.data.rag_context.other).toBe('preserved')
    expect(result.data.updated_at).not.toBe(original.updated_at)
  })
  it('late asynchronous completion cannot overwrite a newly claimed release', async () => {
    const store = releaseStore(), original = await readSocialQueueForWrite(store.admin, 'social-1')
    const claim = await store.admin.from('social_content_queue').update({ rag_context: { ...store.item().rag_context,
      platform_submission_gate: { status: 'submitting', release_id: 'claim' } } })
      .eq('id', original.id).eq('updated_at', original.updated_at).select('*').maybeSingle()
    expect(claim.data).not.toBeNull()
    await expect(updateSocialQueueWithVersion(store.admin, original, { image_url: 'late-result' })).rejects.toThrow('Content changed')
    expect(store.item().image_url).toBeUndefined()
    expect(store.item().rag_context.platform_submission_gate.release_id).toBe('claim')
  })
  it('fails closed without original version or confirmed persistence', async () => {
    const store = releaseStore(), original = structuredClone(store.item())
    expect(() => assertSocialQueueWritable({ ...original, updated_at: undefined })).toThrow()
    store.controls.fail = () => true
    await expect(updateSocialQueueWithVersion(store.admin, original, { post_text: 'new' })).rejects.toThrow()
    expect(store.writes).toHaveLength(0)
  })
})
