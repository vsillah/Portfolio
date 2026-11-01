import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ verifyAdmin: vi.fn(), isAuthError: vi.fn(), artifacts: vi.fn(), from: vi.fn(), single: vi.fn(), calendars: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/auth-server', () => ({ verifyAdmin: mocks.verifyAdmin, isAuthError: mocks.isAuthError }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }))
vi.mock('@/lib/dark-castle-approved-artifacts', () => ({ verifiedDarkCastleApprovedArtifacts: mocks.artifacts }))
import { GET, POST } from './route'
import { DARK_CASTLE_COPY_CALENDAR_ID, DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

const updated = '2026-11-01T14:00:00Z'
const identity = { contentVersion: 'content-v1', masterSha256: 'master-hash', masterPath: '/master.mp4',
  thumbnailSha256: 'thumbnail-hash', thumbnailPath: '/thumb.png', thumbnailDirection: 'C', selectionReceiptId: 'selection-1',
  descriptionReceiptId: 'description-1', evidenceReceiptId: 'evidence-1' }
const receipt = (key: string) => ({ receipt_id: `${key}-1`, status: 'approved', content_updated_at: updated })
const row = () => ({ id: DARK_CASTLE_COPY_CONTENT_ID, updated_at: updated, platform: 'youtube', status: 'draft',
  youtube_title: 'Approved title', youtube_description: 'Approved description', video_url: null, image_url: null,
  rag_context: { content_version: 'content-v1', youtube_description_receipt: { receipt_id: 'description-1',
    social_content_id: DARK_CASTLE_COPY_CONTENT_ID, content_version: 'content-v1',
    description_sha256: 'c487f264b607fae1c48a728e861db9daa1c8737021c7b97d5c965bb96e5fad68', evidence_input_fingerprint: 'fp' },
    description_evidence_reconciliation_receipt: { receipt_id: 'evidence-1', social_content_id: DARK_CASTLE_COPY_CONTENT_ID,
      content_version: 'content-v1', status: 'passed', evidence_input_fingerprint: 'fp' },
    copy_review_evidence_receipts: Object.fromEntries(['source', 'voice', 'framework', 'privacy', 'visual', 'challenger'].map(key => [key, receipt(key)])),
  } })
const request = (method: string, id = DARK_CASTLE_COPY_CONTENT_ID) => new NextRequest(`http://localhost/api/admin/social-content/${id}/bind-approved-master`, { method })
const params = { params: { id: DARK_CASTLE_COPY_CONTENT_ID } }

describe('approved Dark Castle master binding route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'operator' } })
    mocks.isAuthError.mockReturnValue(false)
    mocks.artifacts.mockResolvedValue(identity)
    mocks.single.mockResolvedValue({ data: row(), error: null })
    mocks.calendars.mockResolvedValue({ data: [{ id: DARK_CASTLE_COPY_CALENDAR_ID, social_content_id: DARK_CASTLE_COPY_CONTENT_ID, due_status: 'due_soon' }], error: null })
    mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => table === 'social_content_queue'
      ? { single: mocks.single } : mocks.calendars() }) }))
    mocks.rpc.mockResolvedValue({ data: { work_item_id: 'work-1', current_gate: 'copy_review', external_execution: false }, error: null })
  })

  it('inspects without mutation and binds one exact atomic packet on POST', async () => {
    expect((await GET(request('GET'), params)).status).toBe(200)
    expect(mocks.rpc).not.toHaveBeenCalled()
    const response = await POST(request('POST'), params)
    expect(response.status).toBe(200)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith('bind_dark_castle_youtube_copy_review', expect.objectContaining({
      p_social_content_id: DARK_CASTLE_COPY_CONTENT_ID, p_master_sha256: 'master-hash',
      p_thumbnail_direction: 'C', p_expected_content_updated_at: updated,
    }))
  })

  it('fails before RPC on missing receipts, wrong record, or artifact hash failure', async () => {
    const missing = row(); delete (missing.rag_context.copy_review_evidence_receipts as Record<string, unknown>).source
    mocks.single.mockResolvedValue({ data: missing, error: null })
    expect((await POST(request('POST'), params)).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect((await POST(request('POST', 'other'), { params: { id: 'other' } })).status).toBe(404)
    mocks.artifacts.mockRejectedValue(new Error('hash mismatch'))
    expect((await POST(request('POST'), params)).status).toBe(409)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('returns a conflict for database rollback and never makes a second write', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Social Content version mismatch' } })
    expect((await POST(request('POST'), params)).status).toBe(409)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
  })
})
