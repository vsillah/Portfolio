import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  readSocialQueueForWrite: vi.fn(),
  updateSocialQueueWithVersion: vi.fn(),
  loadLogo: vi.fn(),
  renderPng: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  storageFrom: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/social-queue-write', async () => {
  class SocialQueueWriteConflict extends Error {}
  return {
    SocialQueueWriteConflict,
    readSocialQueueForWrite: mocks.readSocialQueueForWrite,
    updateSocialQueueWithVersion: mocks.updateSocialQueueWithVersion,
  }
})

vi.mock('@/lib/social-deterministic-visual-renderer', () => ({
  loadAmaduTownLogoPng: mocks.loadLogo,
  renderDeterministicVisualPng: mocks.renderPng,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(),
    storage: { from: mocks.storageFrom },
  },
}))

import { POST } from './route'
import { DETERMINISTIC_VISUAL_BINDING_QA_ID } from '@/lib/social-content'
import {
  buildDeterministicVisualAssetPatch,
  deterministicVisualCandidateHash,
  deterministicVisualRenderInputHash,
  projectDeterministicVisualRender,
  readDeterministicVisualSpec,
} from '@/lib/social-deterministic-visual'
import { deterministicVisualBindingQaFixture } from '@/lib/social-deterministic-visual-qa-fixture'
import { practitionerContentQaFixture } from '@/lib/social-practitioner-content-qa-fixture'
import { socialCopyVersion } from '@/lib/social-copy-revision'
import { SocialQueueWriteConflict } from '@/lib/social-queue-write'

function row() {
  const item = practitionerContentQaFixture('ready') as any
  item.id = 'social-1'
  item.status = 'approved'
  item.rag_context.source = 'social_content_calendar_authorization'
  item.rag_context.calendar_item_id = 'calendar-1'
  item.rag_context.publish_gate = 'draft_only'
  delete item.rag_context.qa_fixture
  item.updated_at = '2026-10-10T20:00:00.000Z'
  return item
}

function projection(item = row()) {
  return projectDeterministicVisualRender({
    item,
    copyVersion: socialCopyVersion(item),
    storageAvailable: true,
    releaseLocked: false,
  })
}

function request(item = row(), overrides: Record<string, unknown> = {}) {
  const view = projection(item)
  return new NextRequest('http://localhost/api/admin/social-content/social-1/render-deterministic-visual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expected_copy_version: view.copy_version,
      expected_candidate_id: view.candidate_id,
      expected_candidate_hash: view.candidate_hash,
      expected_visual_type: view.visual_type,
      expected_recipe_version: view.inputs.recipe_version,
      ...overrides,
    }),
  })
}

function fixtureRenderRequest(state: 'ready' | 'current' = 'ready') {
  const item = deterministicVisualBindingQaFixture(state)
  const view = item.deterministic_visual_render!
  return new NextRequest(`http://localhost/api/admin/social-content/${DETERMINISTIC_VISUAL_BINDING_QA_ID}/render-deterministic-visual`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      qa_state: state,
      expected_copy_version: view.copy_version,
      expected_candidate_id: view.candidate_id,
      expected_candidate_hash: view.candidate_hash,
      expected_visual_type: view.visual_type,
      expected_recipe_version: view.inputs.recipe_version,
    }),
  })
}

async function withVercelEnv(value: string | undefined, run: () => Promise<void>) {
  const prior = process.env.VERCEL_ENV
  if (value === undefined) delete process.env.VERCEL_ENV
  else process.env.VERCEL_ENV = value
  try {
    await run()
  } finally {
    if (prior === undefined) delete process.env.VERCEL_ENV
    else process.env.VERCEL_ENV = prior
  }
}

function bindCurrent(item = row()) {
  const copyVersion = socialCopyVersion(item)
  const spec = readDeterministicVisualSpec(item.rag_context)!
  const candidateHash = deterministicVisualCandidateHash(spec)
  const brandAssetHash = 'b'.repeat(64)
  const renderInputHash = deterministicVisualRenderInputHash({ copyVersion, candidateHash, visualType: item.framework_visual_type, brandAssetHash })
  Object.assign(item, buildDeterministicVisualAssetPatch({
    item,
    copyVersion,
    candidateHash,
    renderInputHash,
    brandAssetHash,
    assetSha256: 'a'.repeat(64),
    assetUrl: `https://storage.example/storage/v1/object/public/social-content/current.png`,
    storagePath: 'deterministic/social-1/current.png',
    actor: 'admin-1',
    renderedAt: '2026-10-10T20:05:00.000Z',
  }))
  return item
}

describe('POST /api/admin/social-content/[id]/render-deterministic-visual', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://storage.example'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role'
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.loadLogo.mockResolvedValue(Buffer.from('logo'))
    mocks.renderPng.mockResolvedValue(Buffer.from('deterministic-png'))
    mocks.upload.mockResolvedValue({ data: { path: 'stored.png' }, error: null })
    mocks.getPublicUrl.mockImplementation((storagePath: string) => ({
      data: { publicUrl: `https://storage.example/storage/v1/object/public/social-content/${storagePath}` },
    }))
    mocks.storageFrom.mockReturnValue({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl })
    mocks.updateSocialQueueWithVersion.mockImplementation(async (_admin, original, patch) => ({
      data: { ...original, ...patch, updated_at: '2026-10-10T20:06:00.000Z' },
      error: null,
    }))
  })

  it('renders and stores one version-bound provider-none review asset without calling a media provider', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const externalFetch = vi.spyOn(globalThis, 'fetch')

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, idempotent: false, provider: 'none', provider_calls_enabled: false })
    expect(body.item.rag_context.deterministic_visual_asset).toMatchObject({
      social_content_id: item.id,
      copy_version: socialCopyVersion(item),
      candidate_id: projection(item).candidate_id,
      candidate_hash: projection(item).candidate_hash,
      visual_type: 'architecture',
      effective_inputs: {
        copy_version: socialCopyVersion(item),
        candidate_hash: projection(item).candidate_hash,
        selected_visual_type: 'architecture',
        candidate_visual_type: 'architecture',
      },
      provider_receipt: { provider: 'none', model: null, status: 'not_called', external_call: false },
      provider_calls: { gemini: false, heygen: false, n8n_media: false, other_media: false },
    })
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringContaining(`deterministic/${item.id}/${socialCopyVersion(item)}/`), Buffer.from('deterministic-png'), {
      contentType: 'image/png', cacheControl: '31536000', upsert: false,
    })
    expect(mocks.updateSocialQueueWithVersion).toHaveBeenCalledTimes(1)
    expect(mocks.renderPng).toHaveBeenCalledWith({
      spec: expect.objectContaining({ visual_type: 'architecture' }),
      visualType: 'architecture',
      logoPng: Buffer.from('logo'),
    })
    expect(externalFetch).not.toHaveBeenCalled()
  })

  it('returns the current receipt idempotently without rerendering, uploading, or writing', async () => {
    const item = bindCurrent()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, idempotent: true, provider: 'none' })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('rejects a stale copy version before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const response = await POST(request(item, { expected_copy_version: 'stale' }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'copy_version_stale', provider_calls_enabled: false })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('rejects a candidate hash mismatch before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const response = await POST(request(item, { expected_candidate_hash: 'changed' }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'candidate_hash_mismatch', provider_calls_enabled: false })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('rejects a selected visual type mismatch before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const response = await POST(request(item, { expected_visual_type: 'timeline' }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'visual_type_mismatch', provider_calls_enabled: false })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('rejects a stale persisted recipe version before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const response = await POST(request(item, { expected_recipe_version: 'stale-recipe' }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'recipe_version_mismatch', provider_calls_enabled: false })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('blocks a missing candidate with an in-context recovery action', async () => {
    const item = row()
    item.rag_context.practitioner_content_quality.deterministic_visual.candidate.candidate_id = ''
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const view = projection(item)
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/social-1/render-deterministic-visual', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        expected_copy_version: view.copy_version,
        expected_candidate_id: view.candidate_id,
        expected_candidate_hash: view.candidate_hash,
        expected_visual_type: view.visual_type,
        expected_recipe_version: view.inputs.recipe_version,
      }),
    }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ code: 'candidate_missing', render: { can_render: false } })
    expect(mocks.renderPng).not.toHaveBeenCalled()
  })

  it('blocks an architecture candidate without explicit connectors before renderer or storage work', async () => {
    const item = row()
    item.rag_context.practitioner_content_quality.deterministic_visual.architecture.connectors = []
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const view = projection(item)
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/social-1/render-deterministic-visual', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        expected_copy_version: view.copy_version,
        expected_candidate_id: view.candidate_id,
        expected_candidate_hash: view.candidate_hash,
        expected_visual_type: view.visual_type,
        expected_recipe_version: view.inputs.recipe_version,
      }),
    }), { params: { id: item.id } })
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'architecture_structure_invalid',
      render: { can_render: false, visual_type: 'architecture' },
      recovery_action: expect.stringMatching(/three labeled architecture nodes and two labeled connectors/i),
    })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('fails closed when internal storage is unavailable', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    mocks.upload.mockResolvedValue({ data: null, error: { statusCode: 503, message: 'storage unavailable' } })
    const response = await POST(request(item), { params: { id: item.id } })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      code: 'storage_unavailable',
      provider: 'none',
      provider_calls_enabled: false,
      render: { state: 'blocked', can_render: false },
    })
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('requires admin auth before reading, rendering, or storing a real record', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    const response = await POST(request(), { params: { id: 'social-1' } })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.readSocialQueueForWrite).not.toHaveBeenCalled()
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('keeps the synthetic fixture path closed in production', async () => {
    mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })
    mocks.isAuthError.mockReturnValue(true)

    await withVercelEnv('production', async () => {
      const response = await POST(fixtureRenderRequest(), { params: { id: DETERMINISTIC_VISUAL_BINDING_QA_ID } })
      const body = await response.json()

      expect(response.status).toBe(401)
      expect(body).toEqual({ error: 'Unauthorized' })
      expect(body.fixture).toBeUndefined()
    })

    expect(mocks.readSocialQueueForWrite).not.toHaveBeenCalled()
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('renders a synthetic fixture outside production without auth, storage, or a media provider', async () => {
    await withVercelEnv('preview', async () => {
      const response = await POST(fixtureRenderRequest(), { params: { id: DETERMINISTIC_VISUAL_BINDING_QA_ID } })
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        success: true,
        fixture: true,
        idempotent: false,
        provider: 'none',
        provider_calls_enabled: false,
      })
      expect(body.message).toMatch(/No shared storage, database, or media provider was called/)
    })

    expect(mocks.verifyAdmin).not.toHaveBeenCalled()
    expect(mocks.readSocialQueueForWrite).not.toHaveBeenCalled()
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('rejects a candidate id mismatch before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)

    const response = await POST(request(item, { expected_candidate_id: 'other-candidate' }), { params: { id: item.id } })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'candidate_id_mismatch',
      provider_calls_enabled: false,
    })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON before renderer or storage work', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    const response = await POST(new NextRequest('http://localhost/api/admin/social-content/social-1/render-deterministic-visual', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    }), { params: { id: item.id } })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'copy_version_stale',
      error: 'Copy changed since this visual review opened.',
      provider_calls_enabled: false,
    })
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('returns a closed release-lock response when the queue cannot be read', async () => {
    mocks.readSocialQueueForWrite.mockRejectedValue('relation secret_queue is missing')

    const response = await POST(request(), { params: { id: 'social-1' } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      code: 'release_locked',
      error: 'The current Social Content record could not be prepared for rendering.',
      provider: 'none',
      provider_calls_enabled: false,
    })
    expect(JSON.stringify(body)).not.toContain('secret_queue')
    expect(mocks.renderPng).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('returns a closed renderer failure and does not upload or persist', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    mocks.renderPng.mockRejectedValue(new Error('sharp failed at /secret/font-path'))

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      code: 'render_unavailable',
      error: 'The local HTML/SVG renderer could not create the review asset.',
      provider: 'none',
      provider_calls_enabled: false,
      render: { state: 'blocked', can_render: false },
    })
    expect(JSON.stringify(body)).not.toContain('secret/font-path')
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('refuses to persist an untrusted public asset URL', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://evil.example/storage/v1/object/public/social-content/stolen.png' },
    })

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      code: 'storage_unavailable',
      error: 'Internal Social Content storage did not return a trusted public review URL.',
      provider_calls_enabled: false,
    })
    expect(JSON.stringify(body)).not.toContain('evil.example')
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('refuses a public URL outside the social-content bucket', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example/storage/v1/object/public/social-content-evil/stolen.png' },
    })

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toMatchObject({
      code: 'storage_unavailable',
      error: 'Internal Social Content storage did not return a trusted public review URL.',
    })
    expect(JSON.stringify(body)).not.toContain('social-content-evil')
    expect(mocks.updateSocialQueueWithVersion).not.toHaveBeenCalled()
  })

  it('binds the trusted URL when storage reports the object already exists', async () => {
    const item = row()
    mocks.readSocialQueueForWrite.mockResolvedValue(item)
    mocks.upload.mockResolvedValue({ data: null, error: { statusCode: 409, message: 'The resource already exists' } })

    const response = await POST(request(item), { params: { id: item.id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ success: true, idempotent: false, provider: 'none', provider_calls_enabled: false })
    expect(body.item.image_url).toMatch(/^https:\/\/storage\.example\/storage\/v1\/object\/public\/social-content\//)
    expect(mocks.upload).toHaveBeenCalledWith(expect.any(String), expect.any(Buffer), expect.objectContaining({ upsert: false }))
    expect(mocks.updateSocialQueueWithVersion).toHaveBeenCalledTimes(1)
  })

  it('returns idempotent success when a concurrent write already bound the same candidate', async () => {
    const original = row()
    const latest = bindCurrent(structuredClone(original))
    mocks.readSocialQueueForWrite
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(latest)
    mocks.updateSocialQueueWithVersion.mockRejectedValue(new SocialQueueWriteConflict())

    const response = await POST(request(original), { params: { id: original.id } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      success: true,
      idempotent: true,
      provider: 'none',
      provider_calls_enabled: false,
      message: 'A concurrent request already bound the same deterministic review asset.',
    })
    expect(body.render.state).toBe('current')
    expect(mocks.updateSocialQueueWithVersion).toHaveBeenCalledTimes(1)
  })

  it('returns a write conflict when the record changes during rendering', async () => {
    const original = row()
    mocks.readSocialQueueForWrite
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(row())
    mocks.updateSocialQueueWithVersion.mockRejectedValue(new SocialQueueWriteConflict())

    const response = await POST(request(original), { params: { id: original.id } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      code: 'write_conflict',
      error: 'The Social Content record changed while the local asset was rendering.',
      provider: 'none',
      provider_calls_enabled: false,
      render: { can_render: false },
    })
    expect(body.success).toBeUndefined()
  })

  it('returns a write conflict when the concurrent reload fails', async () => {
    const original = row()
    mocks.readSocialQueueForWrite
      .mockResolvedValueOnce(original)
      .mockRejectedValueOnce(new Error('db secret_relation missing'))
    mocks.updateSocialQueueWithVersion.mockRejectedValue(new SocialQueueWriteConflict())

    const response = await POST(request(original), { params: { id: original.id } })
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body).toMatchObject({
      code: 'write_conflict',
      error: 'The Social Content record changed while the local asset was rendering.',
    })
    expect(JSON.stringify(body)).not.toContain('secret_relation')
  })
})
