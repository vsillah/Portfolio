import { describe, expect, it } from 'vitest'
import { buildMediaGenerationBakeoffPlan } from './media-generation-bakeoff'

describe('buildMediaGenerationBakeoffPlan', () => {
  it('recommends fal for a broad image and video playground workflow', () => {
    const plan = buildMediaGenerationBakeoffPlan({
      title: 'AmaduTown media model bakeoff',
      useCase: 'Compare image and video generation models before installing a selected generator into Portfolio.',
      mode: 'campaign_media',
      priority: 'production_reliability',
      requiredAspectRatios: ['1:1', '16:9', '9:16'],
      referenceAssets: ['AmaduTown shield logo', 'Portfolio admin screenshot'],
      prompts: [
        'Create a branded framework image for a LinkedIn post.',
        'Create a six-second product walkthrough clip from a screenshot.',
      ],
      needsBatchGeneration: true,
      needsApiInstallPath: true,
      needsHumanApproval: true,
      needsBrandConsistency: true,
      needsVideoAudio: true,
      maxAcceptableLatencySeconds: 90,
      maxAcceptableCostUsd: 1.5,
    })

    expect(plan.recommendedProvider).toBe('fal')
    expect(plan.recommendedLabel).toBe('fal media model gallery')
    expect(plan.candidates[0].decision).toMatch(/promote_to_default|pilot_with_guardrails/)
    expect(plan.benchmarkRunbook.join(' ')).toContain('cost per accepted asset')
    expect(plan.portfolioIntegrationPlan.join(' ')).toContain('admin playground')
  })

  it('keeps OpenRouter out of the default video path until video generation fits the workflow', () => {
    const plan = buildMediaGenerationBakeoffPlan({
      title: 'Short-form video bakeoff',
      useCase: 'Evaluate text-to-video models for client-facing short clips.',
      mode: 'text_to_video',
      priority: 'quality',
      needsVideoAudio: true,
      needsApiInstallPath: true,
      needsHumanApproval: true,
    })

    const openrouter = plan.candidates.find((candidate) => candidate.provider === 'openrouter')

    expect(openrouter?.decision).toMatch(/keep_as_specialist|sandbox_only/)
    expect(openrouter?.modelDiscoveryPlan.join(' ')).toMatch(/Avoid treating OpenRouter as the video default/i)
  })

  it('allows a direct provider to win for brand-controlled image work', () => {
    const plan = buildMediaGenerationBakeoffPlan({
      title: 'Brand illustration model choice',
      useCase: 'Pick the strongest image model for precise branded illustrations.',
      mode: 'image_edit',
      priority: 'brand_control',
      currentDefaultProvider: 'direct_provider',
      requiredAspectRatios: ['1:1'],
      referenceAssets: ['AmaduTown shield logo'],
      needsBrandConsistency: true,
      needsHumanApproval: true,
      requiresFirstPartyFeatures: true,
      maxAcceptableLatencySeconds: 120,
      maxAcceptableCostUsd: 2,
    })

    expect(plan.recommendedProvider).toBe('direct_provider')
    expect(plan.promotionGate.join(' ')).toContain('selected Portfolio generator')
    expect(plan.candidates[0].installPlan.join(' ')).toContain('provider-specific API key')
  })
})
