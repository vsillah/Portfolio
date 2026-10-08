import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/supabase', async () => import('@/scripts/qa/campaign-video-fixture'))
vi.mock('@/lib/auth-server', async () => import('@/scripts/qa/campaign-video-fixture'))
import { GET, POST } from './route'
import { reset, tables } from '@/scripts/qa/campaign-video-fixture'
import { editorialInputVersion, VIDEO_EDITORIAL_CRITERIA } from '@/lib/video-editorial-quality'
const params = { params: { id: 'video-review-qa' } }
const read = (query: string) => GET(new NextRequest(`http://localhost/api/review?${query}`), params)
const write = (body: object) => POST(new NextRequest('http://localhost/api/review', { method: 'POST', body: JSON.stringify({ expected_updated_at: tables.social_content_queue[0].updated_at, ...body }) }), params)
beforeEach(reset)
it('lists history separately from eligible candidates and keeps private playback available', async () => {
  const before = JSON.stringify(tables)
  const { jobs } = await (await read('candidates=1')).json()
  expect(jobs[0].eligibility.eligible).toBe(true)
  expect(jobs[1]).toMatchObject({ eligibility: { eligible: false, label: 'Ineligible · history only' }, playback_url: expect.any(String) })
  expect(JSON.stringify(tables)).toBe(before)
  const legacy = tables.video_generation_jobs[1]
  expect((await write({ action: 'attach_video', job_id: legacy.id, job_version: legacy.updated_at })).status).toBe(409)
})
it('rejects a formerly eligible candidate after live source approval changes', async () => {
  const job = tables.video_generation_jobs[0]
  tables.agent_work_items[0].metadata.channel_lanes.linkedin.draft_packet.approval_status = 'in_review'
  expect((await (await read(`job_id=${job.id}`)).json()).job.eligibility.eligible).toBe(false)
  expect((await write({ action: 'attach_video', job_id: job.id, job_version: job.updated_at })).status).toBe(409)
})
it('records explicit editorial evidence but never retroactively qualifies a legacy render', async () => {
  const item = tables.social_content_queue[0]
  const body = { action: 'approve_editorial', input_version: editorialInputVersion(item), avatar_id: 'synthetic-avatar', voice_id: 'synthetic-voice', checks: Object.fromEntries(Object.keys(VIDEO_EDITORIAL_CRITERIA).map(key => [key, true])), notes: 'The spoken problem, explanation and invitation match the approved campaign. Claims are limited to the synthetic example.' }
  expect((await write({ ...body, avatar_id: 'stale-default' })).status).toBe(409)
  expect((await write({ ...body, checks: {} })).status).toBe(409)
  expect((await write(body)).status).toBe(200)
  expect(item.rag_context.campaign_video_editorial.reviewer).toBe('synthetic-admin')
  expect((await (await read(`job_id=${tables.video_generation_jobs[1].id}`)).json()).job.eligibility.eligible).toBe(false)
})
