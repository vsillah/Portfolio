import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import packet from '@/artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-social-video-review-package-v1.json'
import SocialVideoProductionControls from './SocialVideoProductionControls'
import type { SocialVideoReviewPackage } from '@/lib/social-video-review-package'
import type { HeyGenLongFormProductionRecipe } from '@/lib/heygen-long-form-production-recipe'

vi.mock('@/lib/heygen-long-form-production-recipe', () => ({
  evaluateHeyGenLongFormRecipe: () => ({
    readyForReview: true,
    readyForProviderGeneration: false,
    blockers: [],
    selectedLookId: 'look-next',
    selectedEnvironmentId: 'env-next',
  }),
}))

const props = {
  reviewPackage: packet as SocialVideoReviewPackage,
  approvedSourceReceiptIds: ['source:jev:approved-composite-20261014', 'source:music:the-stream-v2:20261014'],
  approvedRightsReceiptIds: ['rights:jev:owned-public-assets-20261014', 'rights:music:the-stream-v2:20261014'],
}

const longFormRecipe = {
  campaign: { content_version: 'content:v7' },
  evidence: {
    packet_version: 'evidence:v3',
    product_screenshots: [{ asset_id: 'asset-product' }],
  },
  deliverables: {
    master: { duration_seconds: 600 },
    derivatives: [{ deliverable_id: 'short-1', channel: 'youtube_shorts', aspect_ratio: '9:16', inherited_evidence_packet_id: 'evidence:v3' }],
  },
  provider: {
    selected_engine: 'avatar_iv',
    production_route: 'avatar_video_native_composite',
    capability_snapshot: { version: 'heygen_capabilities_2026_10_17' },
  },
  rotation: {
    previous_look_id: 'look-old',
    previous_environment_id: 'env-old',
    proposed_look_id: 'look-next',
    proposed_environment_id: 'env-next',
    override_look_id: null,
    override_environment_id: null,
    look_pool: [
      { id: 'look-old', label: 'Previous look', capability_verified: true },
      { id: 'look-next', label: 'Navy editorial', capability_verified: true },
      { id: 'look-alt', label: 'Sand workshop', capability_verified: true },
    ],
    environment_pool: [
      { id: 'env-old', label: 'Previous environment', capability_verified: true },
      { id: 'env-next', label: 'Product wall', capability_verified: true },
      { id: 'env-alt', label: 'Quiet studio', capability_verified: true },
    ],
  },
  scene_plan: [{ scene_id: 'scene-1', start_seconds: 0, end_seconds: 600, role: 'product_demo', motion_prompt: 'Review the product proof at reading pace.', product_asset_ids: ['asset-product'] }],
  budget: { estimated_run_credits: 10, per_run_credit_ceiling: 12, estimated_run_usd: 3.5, per_run_usd_ceiling: 5 },
} as unknown as HeyGenLongFormProductionRecipe

describe('SocialVideoProductionControls', () => {
  it('renders version-bound music, motion, A/B, and closed decision actions', () => {
    render(<SocialVideoProductionControls {...props} />)
    expect(screen.getByText('The Stream 2.0 beat stem')).toBeInTheDocument()
    expect(screen.getByText('Restrained editorial focus')).toBeInTheDocument()
    expect(screen.getByLabelText('enhanced original Jev video preview')).toHaveAttribute('src', '/review-assets/social-content/jev-youtube-motion-review.mp4')
    expect(screen.getByRole('button', { name: 'Render current' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Decision pending' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'A · No music' })).toBeInTheDocument()
    expect(screen.getByText(/6 restored native teaching scenes/i)).toBeInTheDocument()
  })

  it('offers a local naturalized voice reference and invalidates the bound render', async () => {
    const user = userEvent.setup()
    render(<SocialVideoProductionControls {...props} />)
    await user.click(screen.getByRole('radio', { name: 'Naturalized · review only' }))
    expect(screen.getByLabelText('enhanced naturalized Jev video preview')).toHaveAttribute('src', '/review-assets/social-content/jev-youtube-naturalized-voice-review.mp4')
    expect(screen.getByText('Unrendered changes')).toBeInTheDocument()
  })

  it('marks changed controls dirty, blocks render, and restores the approved binding', async () => {
    const user = userEvent.setup()
    render(<SocialVideoProductionControls {...props} />)
    await user.click(screen.getByRole('radio', { name: 'No music' }))
    expect(screen.getByText('Unrendered changes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Render blocked' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Reset approved' }))
    expect(screen.getByText('Render validated')).toBeInTheDocument()
  })

  it('shows the fail-closed blocker when rights are not approved', () => {
    render(<SocialVideoProductionControls {...props} approvedRightsReceiptIds={[]} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/rights receipt is missing or unapproved/i)
  })

  it('shows a compact review-only long-form recipe with visible rotation overrides and closed generation', async () => {
    const user = userEvent.setup()
    render(<SocialVideoProductionControls {...props} longFormRecipe={longFormRecipe} expectedContentVersion="content:v7" />)

    const panel = screen.getByRole('region', { name: 'HeyGen long-form production recipe' })
    expect(panel).toHaveTextContent('Long-form master and channel derivatives')
    expect(panel).toHaveTextContent('YouTube master · 10 min')
    expect(panel).toHaveTextContent('10 / 12 credits')
    expect(screen.getByRole('button', { name: 'Provider generation locked' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Review override', { selector: '#heygen-look-override' }), 'look-alt')
    expect(screen.getByLabelText('Review override', { selector: '#heygen-look-override' })).toHaveValue('look-alt')
  })
})
