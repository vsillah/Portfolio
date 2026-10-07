import { qualify } from '@/scripts/qa/campaign-video-fixture'
import { beforeEach, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/supabase', async () => import('@/scripts/qa/linkedin-video-fixture'))
vi.mock('@/lib/auth-server', async () => import('@/scripts/qa/linkedin-video-fixture'))
import { GET, POST } from './route'
import { reset, tables, setLoseUpdate } from '@/scripts/qa/linkedin-video-fixture'
import { socialVideoAssetVersion } from '@/lib/social-video-review'
const params = { params: { id: 'video-review-qa' } }
const read = () => GET(new NextRequest('http://localhost/api/review'), params)
const write = (body: object) => POST(new NextRequest('http://localhost/api/review', { method: 'POST', body: JSON.stringify(body) }), params)
beforeEach(reset)
it('previews without mutation, synchronizes once, and rejects a stale target and subsequent human edit', async () => {
  const before = JSON.stringify(tables)
  const { preview } = await (await read()).json()
  expect(JSON.stringify(tables)).toBe(before)
  const body = { action: 'synchronize', packet_version: preview.packet_version, expected_updated_at: preview.target_version }
  expect((await write({ ...body, expected_updated_at: 'stale' })).status).toBe(409)
  expect((await write(body)).status).toBe(200)
  expect(await (await write(body)).json()).toMatchObject({ unchanged: true })
  tables.social_content_queue[0].post_text = 'Human revision'
  expect((await write(body)).status).toBe(409)
})
it('rejects a lost CAS update without claiming success', async () => {
  const { preview } = await (await read()).json(); setLoseUpdate(true)
  expect((await write({ action: 'synchronize', packet_version: preview.packet_version, expected_updated_at: preview.target_version })).status).toBe(409)
})
it('attaches a known completed job, approves its exact asset, then invalidates on replacement', async () => {
  const item = tables.social_content_queue[0], job = tables.video_generation_jobs[0]
  qualify(item, tables.social_content_calendar_items[0], tables.agent_work_items[0], tables.video_generation_jobs.slice(0, 2))
  expect((await write({ action: 'attach_video', expected_updated_at: item.updated_at, job_id: job.id, job_version: 'stale' })).status).toBe(409)
  expect((await write({ action: 'attach_video', expected_updated_at: item.updated_at, job_id: job.id, job_version: job.updated_at })).status).toBe(200)
  item.status = 'approved'
  expect((await write({ action: 'approve_media', expected_updated_at: item.updated_at, asset_version: socialVideoAssetVersion(item), privacy_confirmed: true })).status).toBe(200)
  expect(item.rag_context.media_review.status).toBe('approved')
  const replacement = tables.video_generation_jobs[1]
  expect((await write({ action: 'attach_video', expected_updated_at: item.updated_at, job_id: replacement.id, job_version: replacement.updated_at })).status).toBe(200)
  expect(item.rag_context.media_review.status).toBe('pending')
})
