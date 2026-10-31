import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'

const VERSION = '2026-10-25T10:00:00.000Z'
const WORK_ITEM_ID = 'work item/1'
const SOURCE_QUEUE_HREF = '/admin/agents/coordination?source_type=social_content_internal_review&source_id=social-1'
const PROPOSAL_QUEUE_HREF = '/admin/agents/coordination?proposal=work%20item%2F1'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  search: '',
  id: 'social-1',
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mocks.id }),
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}))

vi.mock('@/components/ProtectedRoute', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/admin/Breadcrumbs', () => ({
  default: () => null,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

function receipt(id: string, version = VERSION) {
  return {
    receipt_id: id,
    status: 'approved',
    content_updated_at: version,
  }
}

function decisionPacket(gate: string, version = VERSION) {
  return {
    version: 'social-content-decision-review/v1',
    approval_id: 'approval-1',
    run_id: 'run-1',
    work_item_id: WORK_ITEM_ID,
    content_id: 'social-1',
    content_updated_at: version,
    current_gate: gate,
    next_gate: 'platform_submission',
    receipts: {
      source: receipt('receipt-source', version),
      voice: receipt('receipt-voice', version),
      framework: receipt('receipt-framework', version),
      privacy: receipt('receipt-privacy', version),
      visual: receipt('receipt-visual', version),
      challenger: receipt('receipt-challenger', version),
    },
  }
}

function queueItem(overrides: {
  updatedAt?: string
  currentGate?: string | null
  packet?: Record<string, unknown> | null
}) {
  const currentGate = overrides.currentGate
  return {
    id: 'social-1',
    meeting_record_id: null,
    platform: 'linkedin',
    status: 'approved',
    post_text: 'The draft copy is approved and should stay locked.',
    cta_text: 'Build with receipts.',
    cta_url: null,
    hashtags: ['AgentOps', 'AI'],
    image_url: null,
    image_prompt: 'Create a framework visual about review gates.',
    framework_visual_type: 'architecture',
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: {
      source: 'agent_ops_social_outreach_goal',
      publish_gate: 'draft_only',
      goal_id: 'goal-123',
      pass_to_human: true,
      visual_brief: 'Show the review gates.',
      ...(currentGate === undefined ? {} : { current_gate: currentGate }),
      ...(overrides.packet ? { mobile_decision_review: overrides.packet } : {}),
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: 'admin-user',
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    content_format: 'single_image',
    content_pillar: null,
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    created_at: '2026-06-12T10:00:00.000Z',
    updated_at: overrides.updatedAt ?? VERSION,
    publishes: [],
  }
}

function renderQueueItem(item: ReturnType<typeof queueItem>, prepareResponse?: () => Response | Promise<Response>) {
  mocks.search = 'step=visuals&review=mobile'
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/prepare-stage-review') && init?.method === 'POST') {
      return prepareResponse?.() ?? {
        ok: false,
        json: async () => ({ error: 'Stage preparation was rejected.' }),
      } as Response
    }
    if (String(input).includes('/topic-backlog')) {
      return { ok: true, json: async () => ({ items: [] }) } as Response
    }
    return { ok: true, json: async () => ({ item }) } as Response
  }))
  return render(<SocialContentDetailRoute />)
}

async function openApprovalDetails() {
  const summary = await screen.findByText(/Approval details/)
  fireEvent.click(summary)
  return screen.getByRole('group', { name: 'Current approval step details' })
}

describe('Social content stage review preparation visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.id = 'social-1'
    mocks.search = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hides preparation and opens the bound work item when the ready packet matches the current version', async () => {
    renderQueueItem(queueItem({
      currentGate: 'asset_packet',
      packet: decisionPacket('asset_packet'),
    }))

    const details = await openApprovalDetails()

    expect(details).not.toHaveTextContent('Prepare the current internal decision')
    expect(screen.queryByTestId('prepare-stage-review')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute('href', PROPOSAL_QUEUE_HREF)
    expect(vi.mocked(fetch).mock.calls.some(([input, init]) => (
      String(input).includes('/prepare-stage-review') && (init as RequestInit | undefined)?.method === 'POST'
    ))).toBe(false)
  })

  it('keeps preparation available when a ready packet belongs to a different gate', async () => {
    renderQueueItem(queueItem({
      currentGate: 'privacy',
      packet: decisionPacket('asset_packet'),
    }))

    const prepare = await screen.findByTestId('prepare-stage-review')

    expect(prepare).toHaveTextContent('Prepare Decision Queue packet')
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute('href', SOURCE_QUEUE_HREF)
  })

  it('keeps preparation available when the packet is one millisecond behind the record', async () => {
    renderQueueItem(queueItem({
      updatedAt: '2026-10-25T10:00:00.001Z',
      currentGate: 'privacy',
      packet: decisionPacket('privacy', VERSION),
    }))

    const prepare = await screen.findByTestId('prepare-stage-review')

    expect(prepare).toHaveTextContent('Prepare Decision Queue packet')
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute('href', SOURCE_QUEUE_HREF)
  })

  it('shows preparation for a privacy gate that has no current packet', async () => {
    renderQueueItem(queueItem({ currentGate: 'privacy' }))

    expect(await screen.findByTestId('prepare-stage-review')).toHaveTextContent('Prepare Decision Queue packet')
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute('href', SOURCE_QUEUE_HREF)
  })

  it.each([
    'copy',
    'copy_review',
    'visual_review',
    'visual_assets',
    'platform_submission',
    'submit',
    'Asset_Packet',
    '',
  ])('hides preparation for non-preparable gate %j', async (currentGate) => {
    renderQueueItem(queueItem({ currentGate }))

    const details = await openApprovalDetails()

    expect(details).not.toHaveTextContent('Prepare the current internal decision')
    expect(screen.queryByTestId('prepare-stage-review')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute('href', SOURCE_QUEUE_HREF)
  })

  it('does not navigate when preparation is rejected or returns no canonical href', async () => {
    const rejected = queueItem({ currentGate: 'privacy' })
    const { unmount } = renderQueueItem(rejected, () => ({
      ok: false,
      status: 409,
      json: async () => ({
        error: 'Stage preparation was rejected.',
        canonical_href: '/admin/social-content/social-1?step=visuals&review=mobile&proposal=work-asset#social-asset-packet-gate',
      }),
    } as Response))

    fireEvent.click(await screen.findByTestId('prepare-stage-review'))

    expect(await screen.findByText('Stage preparation was rejected.')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
    const prepareCall = vi.mocked(fetch).mock.calls.find(([input, init]) => (
      String(input).includes('/prepare-stage-review') && (init as RequestInit | undefined)?.method === 'POST'
    ))
    expect(prepareCall?.[0]).toBe('/api/admin/social-content/social-1/prepare-stage-review')
    expect(prepareCall?.[1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: {
        Authorization: 'Bearer admin-token',
        'Content-Type': 'application/json',
      },
    })

    unmount()
    mocks.push.mockClear()
    renderQueueItem(rejected, () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, canonical_href: '' }),
    } as Response))

    fireEvent.click(await screen.findByTestId('prepare-stage-review'))

    expect(await screen.findByText('Failed to prepare the Decision Queue packet')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
