import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import VideoGenerationPage from './page'

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  useWorkflowStatus: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: mocks.getCurrentSession,
}))

vi.mock('@/lib/hooks/useWorkflowStatus', () => ({
  useWorkflowStatus: mocks.useWorkflowStatus,
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const emptyWorkflowStatus = {
  state: 'idle',
  currentRun: null,
  recentRuns: [],
  runningCount: 0,
  elapsedMs: 0,
  isDrawerOpen: false,
  isHistoryOpen: false,
  toggleDrawer: vi.fn(),
  toggleHistory: vi.fn(),
  onTriggerStarted: vi.fn(),
  markRunFailed: vi.fn(),
  refetch: vi.fn(),
}

const draft = {
  id: 'draft-actual-123',
  title: 'Regression Draft',
  script_text: 'A short approved script for a readiness check.',
  storyboard_json: {
    scenes: [
      { sceneNumber: 1, description: 'Show dashboard proof', brollHint: 'dashboard' },
    ],
  },
  source: 'manual',
  status: 'pending',
  video_generation_job_id: null,
  custom_prompt: null,
  script_template_id: null,
  script_outline: {
    pain_point: 'Manual handoffs',
    hook: 'Stop losing the handoff',
    open_loop: 'The missing receipt',
    cta: 'Review the audit',
  },
  script_scorecard: {
    overall_score: 82,
    pain_clarity: 80,
    hook_strength: 80,
    loop_retention: 80,
    proof_density: 80,
    cta_clarity: 80,
    vambah_authority: 80,
    source_distance_safety: 80,
    blockers: [],
    warnings: [],
    notes: [],
  },
  research_packet_ids: null,
  created_at: '2026-06-30T10:00:00.000Z',
}

const brollAsset = {
  id: 'broll-dashboard',
  route: '/admin',
  route_description: 'dashboard overview',
  filename: 'dashboard-proof.png',
  screenshot_path: '/screens/dashboard-proof.png',
  clip_path: null,
  captured_at: '2026-06-29T10:00:00.000Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('VideoGenerationPage review workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCurrentSession.mockResolvedValue({ access_token: 'admin-token' })
    mocks.useWorkflowStatus.mockReturnValue(emptyWorkflowStatus)

    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    })

    class MockIntersectionObserver {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }

    window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  })

  it('checks render readiness with the selected draft id', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString()

      if (url === '/api/admin/video-generation/ideas-queue?status=pending') {
        return jsonResponse({ items: [draft] })
      }
      if (url === '/api/admin/video-generation/queue?status=pending') {
        return jsonResponse({ items: [] })
      }
      if (url === '/api/admin/video-generation/broll-library') {
        return jsonResponse({ assets: [brollAsset] })
      }
      if (url === '/api/admin/video-generation/script-templates') {
        return jsonResponse({ templates: [] })
      }
      if (url.startsWith('/api/admin/video-generation/jobs?')) {
        return jsonResponse({ jobs: [], total: 0 })
      }
      if (url.startsWith('/api/admin/video-generation/meetings?')) {
        return jsonResponse({ meetings: [], total: 0 })
      }
      if (url === '/api/admin/video-generation/avatars') {
        return jsonResponse({ avatars: [] })
      }
      if (url.startsWith('/api/admin/contacts-search?')) {
        return jsonResponse({ contacts: [] })
      }
      if (url === '/api/admin/video-generation/ideas-queue/draft-actual-123/render-readiness') {
        expect(init?.method).toBe('POST')
        expect(JSON.parse(String(init?.body))).toMatchObject({
          channel: 'youtube',
          aspectRatio: '16:9',
          brollAssetIds: ['broll-dashboard'],
        })
        return jsonResponse({
          report: {
            ready: true,
            blockingIssues: [],
            warnings: [],
            details: {
              scriptCharacters: draft.script_text.length,
              storyboardScenes: 1,
              brollAssetIds: ['broll-dashboard'],
              heygenMode: 'avatar_voice',
              approvalBoundary: 'Readiness check passed.',
              scriptScorecard: draft.script_scorecard,
            },
          },
        })
      }

      return jsonResponse({})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<VideoGenerationPage />)

    const draftQueueButton = await screen.findByRole('button', { name: /Regression Draft/i })
    await userEvent.click(draftQueueButton)
    await userEvent.click(screen.getByRole('button', { name: /Render Readiness/i }))
    await userEvent.click(screen.getByRole('button', { name: /Check readiness/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/video-generation/ideas-queue/draft-actual-123/render-readiness',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('[object Object]'),
      expect.anything(),
    )
  })
})
