import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  buildContentPackagePptxBuffer: vi.fn(),
  contentPackagePptxFileName: vi.fn(),
  from: vi.fn(),
  storageFrom: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/content-packages', () => ({
  CONTENT_PACKAGE_APPROVAL_TYPES: {
    media: 'content_package_media_generation',
  },
}))

vi.mock('@/lib/content-package-pptx', () => ({
  buildContentPackagePptxBuffer: mocks.buildContentPackagePptxBuffer,
  contentPackagePptxFileName: mocks.contentPackagePptxFileName,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  },
}))

import { POST } from './route'

const contentPackage = {
  id: 'package-1',
  title: 'AI Ops field guide',
  agent_run_id: 'run-1',
  source_packet: { transcript: 'Source notes' },
  research_packet: { proof: ['Client ops smoke evidence'] },
  presentation_plan: { recommendedTool: 'codex_pptx' },
  metadata: { source: 'voice_note_content_package' },
}

const packageOutputs = [
  {
    id: 'output-post',
    output_type: 'linkedin_post',
    title: 'LinkedIn post',
    body: 'Post body',
    payload: { hashtags: ['#AgentOps'] },
    status: 'waiting_approval',
    metadata: { required_approval: 'script' },
  },
  {
    id: 'output-pptx',
    output_type: 'pptx_deck',
    title: 'Executive deck',
    body: 'Deck body',
    payload: { slides: [{ title: 'Operating loop' }] },
    status: 'waiting_approval',
    metadata: { required_approval: 'media' },
  },
]

interface SupabaseState {
  approvalStatus: string | null
  outputs: typeof packageOutputs
  updateCalls: unknown[]
  uploaded: unknown[]
}

function request() {
  return new NextRequest('http://localhost/api/admin/social-content/content-packages/package-1/pptx', {
    method: 'POST',
  })
}

function setupSupabase(state: SupabaseState) {
  state.updateCalls = []
  state.uploaded = []

  mocks.from.mockImplementation((table: string) => ({
    select: vi.fn(() => {
      if (table === 'content_packages') {
        return {
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: contentPackage, error: null }),
          })),
        }
      }
      if (table === 'agent_approvals') {
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: state.approvalStatus
                  ? {
                      id: 'approval-media',
                      status: state.approvalStatus,
                      approval_type: 'content_package_media_generation',
                    }
                  : null,
                error: null,
              }),
            })),
          })),
        }
      }
      if (table === 'content_package_outputs') {
        return {
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: state.outputs, error: null }),
          })),
        }
      }
      return {}
    }),
    update: vi.fn((payload: unknown) => {
      state.updateCalls.push(payload)
      return {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
    }),
  }))

  mocks.storageFrom.mockReturnValue({
    upload: vi.fn((path: string, buffer: Buffer, options: unknown) => {
      state.uploaded.push({ path, buffer, options })
      return Promise.resolve({ data: { path }, error: null })
    }),
    createSignedUrl: vi.fn((path: string) => Promise.resolve({
      data: { signedUrl: `https://signed.example/${path}` },
      error: null,
    })),
  })
}

describe('POST /api/admin/social-content/content-packages/[id]/pptx', () => {
  let state: SupabaseState

  beforeEach(() => {
    state = {
      approvalStatus: 'approved',
      outputs: packageOutputs,
      updateCalls: [],
      uploaded: [],
    }
    vi.clearAllMocks()
    vi.spyOn(Date, 'now').mockReturnValue(1780644000000)
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' }, isAdmin: true })
    mocks.isAuthError.mockReturnValue(false)
    mocks.contentPackagePptxFileName.mockReturnValue('ai-ops-field-guide.pptx')
    mocks.buildContentPackagePptxBuffer.mockResolvedValue(Buffer.from('pptx-buffer'))
    setupSupabase(state)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires approved media generation before building or uploading a deck', async () => {
    state.approvalStatus = 'pending'

    const response = await POST(request(), { params: { id: 'package-1' } })

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Media generation approval is required before creating the PPTX artifact.',
      approvalRequired: 'content_package_media_generation',
      agentRunId: 'run-1',
    })
    expect(mocks.buildContentPackagePptxBuffer).not.toHaveBeenCalled()
    expect(mocks.storageFrom).not.toHaveBeenCalled()
    expect(state.updateCalls).toEqual([])
  })

  it('uploads the generated PPTX and links only the PPTX output to the document artifact', async () => {
    const response = await POST(request(), { params: { id: 'package-1' } })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      packageId: 'package-1',
      storagePath: 'content-packages/package-1/1780644000000-ai-ops-field-guide.pptx',
      fileName: 'ai-ops-field-guide.pptx',
      signedUrl: 'https://signed.example/content-packages/package-1/1780644000000-ai-ops-field-guide.pptx',
    })
    expect(mocks.buildContentPackagePptxBuffer).toHaveBeenCalledWith({
      title: 'AI Ops field guide',
      sourcePacket: contentPackage.source_packet,
      researchPacket: contentPackage.research_packet,
      presentationPlan: contentPackage.presentation_plan,
      outputs: [
        expect.objectContaining({ output_type: 'linkedin_post', title: 'LinkedIn post' }),
        expect.objectContaining({ output_type: 'pptx_deck', title: 'Executive deck' }),
      ],
    })
    expect(state.uploaded).toEqual([
      {
        path: 'content-packages/package-1/1780644000000-ai-ops-field-guide.pptx',
        buffer: Buffer.from('pptx-buffer'),
        options: {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          cacheControl: '3600',
          upsert: false,
        },
      },
    ])
    expect(state.updateCalls).toEqual([
      expect.objectContaining({
        status: 'generated',
        approval_id: 'approval-media',
        downstream_type: 'documents',
        downstream_id: 'content-packages/package-1/1780644000000-ai-ops-field-guide.pptx',
        payload: expect.objectContaining({
          slides: [{ title: 'Operating loop' }],
          pptx_storage_path: 'content-packages/package-1/1780644000000-ai-ops-field-guide.pptx',
          pptx_file_name: 'ai-ops-field-guide.pptx',
          generated_by_user_id: 'admin-1',
        }),
        metadata: expect.objectContaining({
          required_approval: 'media',
          generated_artifact_type: 'pptx',
          approval_id: 'approval-media',
        }),
      }),
    ])
  })
})
