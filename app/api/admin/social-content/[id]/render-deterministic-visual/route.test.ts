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
import {
  buildDeterministicVisualAssetPatch,
  deterministicVisualCandidateHash,
  deterministicVisualRenderInputHash,
  projectDeterministicVisualRender,
  readDeterministicVisualSpec,
} from '@/lib/social-deterministic-visual'
import { practitionerContentQaFixture } from '@/lib/social-practitioner-content-qa-fixture'
import { socialCopyVersion } from '@/lib/social-copy-revision'

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
      ...overrides,
    }),
  })
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
})
