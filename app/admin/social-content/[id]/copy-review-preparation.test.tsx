import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SocialContentDetailRoute from './page'

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
  refreshCurrentSession: vi.fn(async () => null),
}))

const updatedAt = '2026-10-28T12:00:00.000Z'

function copyReviewItem(ragContext: Record<string, unknown>) {
  return {
    id: 'social-1',
    meeting_record_id: null,
    platform: 'linkedin',
    status: 'draft',
    post_text: 'The draft copy is waiting for its first internal review.',
    cta_text: 'Build with receipts.',
    cta_url: null,
    hashtags: ['AgentOps'],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
    rag_context: ragContext,
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
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
    created_at: '2026-10-28T11:00:00.000Z',
    updated_at: updatedAt,
    publishes: [],
  }
}

describe('Social Content initial copy-review preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.id = 'social-1'
    mocks.search = 'step=copy'
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderItem(
    item: ReturnType<typeof copyReviewItem>,
    prepareResponse: { ok: boolean, body: Record<string, unknown> },
  ) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/prepare-copy-review') && init?.method === 'POST') {
        return { ok: prepareResponse.ok, json: async () => prepareResponse.body } as Response
      }
      if (url.includes('/topic-backlog')) {
        return { ok: true, json: async () => ({ items: [] }) } as Response
      }
      return { ok: true, json: async () => ({ item }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<SocialContentDetailRoute />)
    return fetchMock
  }

  it('prepares an unbound copy review through the copy-review route and opens its canonical packet', async () => {
    const canonicalHref = '/admin/social-content/social-1?step=copy&review=mobile&proposal=work-1#social-copy-gate'
    const fetchMock = renderItem(
      copyReviewItem({ current_gate: 'copy_review', publish_gate: 'draft_only' }),
      { ok: true, body: { ok: true, canonical_href: canonicalHref, external_execution: false } },
    )

    const prepare = await screen.findByTestId('prepare-stage-review')
    expect(prepare).toHaveTextContent('Prepare Decision Queue packet')
    fireEvent.click(prepare)

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(canonicalHref))
    const prepareCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/prepare-copy-review'))
    expect(prepareCall?.[0]).toBe('/api/admin/social-content/social-1/prepare-copy-review')
    expect(prepareCall?.[1]).toMatchObject({
      method: 'POST',
      body: '{}',
      headers: { Authorization: 'Bearer admin-token' },
    })
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/prepare-stage-review'))).toBe(false)
  })

  it('keeps preparation hidden when a decision packet is already stored on the copy gate', async () => {
    renderItem(
      copyReviewItem({
        current_gate: 'copy_review',
        publish_gate: 'draft_only',
        mobile_decision_review: {},
      }),
      { ok: true, body: { ok: true, canonical_href: '/should-not-navigate' } },
    )

    const summary = await screen.findByText(/Approval details/)
    fireEvent.click(summary)
    expect(screen.queryByTestId('prepare-stage-review')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Decision Queue/ })).toHaveAttribute(
      'href',
      '/admin/agents/coordination?source_type=social_content_internal_review&source_id=social-1',
    )
  })

  it('stays on the copy gate when copy-review preparation conflicts', async () => {
    const fetchMock = renderItem(
      copyReviewItem({ current_gate: 'copy_review', publish_gate: 'draft_only' }),
      {
        ok: false,
        body: { error: 'An existing Decision Queue packet is stale or already bound to another gate' },
      },
    )

    fireEvent.click(await screen.findByTestId('prepare-stage-review'))

    expect(await screen.findByText('An existing Decision Queue packet is stale or already bound to another gate')).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith('/prepare-copy-review'))).toBe(true)
  })
})
