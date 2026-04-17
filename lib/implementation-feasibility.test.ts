import { describe, it, expect } from 'vitest'
import {
  buildFeasibilityAssessment,
  mergeClientStack,
  projectForClient,
  type ProposedItemInput,
  type ClientStackSources,
} from './implementation-feasibility'
import type { TechStackItem } from './tech-stack-lookup'

const tech = (name: string, tag?: string, categories?: string[]): TechStackItem => ({
  name,
  tag,
  categories,
})

const service = (content_id: string, title: string, tech_stack: ProposedItemInput['tech_stack'] = null): ProposedItemInput => ({
  content_type: 'service',
  content_id,
  title,
  tech_stack,
})

describe('mergeClientStack', () => {
  it('returns empty when no sources have data', () => {
    const merged = mergeClientStack({})
    expect(merged.source).toBe('empty')
    expect(merged.technologies).toHaveLength(0)
    expect(merged.conflicts).toHaveLength(0)
  })

  it('uses verified as authoritative and reports no conflicts', () => {
    const sources: ClientStackSources = {
      verified: { technologies: [tech('Shopify', 'Ecommerce')] },
      audit: { technologies: [tech('WooCommerce', 'Ecommerce')] },
      builtwith: { technologies: [tech('Magento', 'Ecommerce')] },
    }
    const merged = mergeClientStack(sources)
    expect(merged.source).toBe('verified')
    expect(merged.technologies.map((t) => t.name)).toEqual(['Shopify'])
    expect(merged.conflicts).toHaveLength(0)
  })

  it('detects a conflict when audit and BuiltWith disagree on same category', () => {
    const merged = mergeClientStack({
      audit: { technologies: [tech('WooCommerce', 'Ecommerce')] },
      builtwith: { technologies: [tech('Shopify', 'Ecommerce')] },
    })
    expect(merged.source).toBe('merged')
    expect(merged.conflicts).toHaveLength(1)
    expect(merged.conflicts[0]).toMatchObject({
      category: 'ecommerce',
      audit: 'WooCommerce',
      builtwith: 'Shopify',
    })
  })

  it('does not conflict when audit and BuiltWith agree on the same name', () => {
    const merged = mergeClientStack({
      audit: { technologies: [tech('Shopify', 'Ecommerce')] },
      builtwith: { technologies: [tech('Shopify', 'Ecommerce')] },
    })
    expect(merged.conflicts).toHaveLength(0)
  })

  it('falls back to BuiltWith when only builtwith is present', () => {
    const merged = mergeClientStack({
      builtwith: { technologies: [tech('Google Analytics', 'Analytics')] },
    })
    expect(merged.source).toBe('builtwith')
    expect(merged.technologies[0]).toMatchObject({ name: 'Google Analytics', category: 'analytics' })
  })

  it('normalizes unknown tags to null category but keeps the technology', () => {
    const merged = mergeClientStack({
      builtwith: { technologies: [tech('SomeObscureTool', 'UnknownTag')] },
    })
    expect(merged.technologies[0]).toMatchObject({ name: 'SomeObscureTool', category: null })
  })

  it('dedupes by name across sources (case-insensitive)', () => {
    const merged = mergeClientStack({
      audit: { technologies: [tech('Stripe', 'Payments')] },
      builtwith: { technologies: [tech('stripe', 'Payments')] },
    })
    expect(merged.technologies).toHaveLength(1)
  })
})

describe('buildFeasibilityAssessment', () => {
  const emptyClient: ClientStackSources = {}
  const bundle = { id: 'b1', name: 'Starter Bundle' }

  it('returns an empty assessment when no proposed items', () => {
    const a = buildFeasibilityAssessment({ proposedItems: [], bundle, clientStack: emptyClient })
    expect(a.items).toHaveLength(0)
    expect(a.stack_fit_summary).toMatch(/no proposed items/i)
    expect(a.overall_feasibility).toBe('high')
  })

  it('inherits defaults when a proposed item has null tech_stack', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [service('s1', 'Custom Service')],
      bundle,
      clientStack: emptyClient,
    })
    expect(a.items).toHaveLength(1)
    expect(a.items[0].inferred_from_defaults).toBe(true)
    expect(a.items[0].requires.platform.length).toBeGreaterThan(0)
  })

  it('uses per-asset tech_stack when provided (overrides default)', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Voice Agent', {
          platform: ['Next.js 14'],
          integrations: [{ system: 'Vapi', direction: 'outbound', method: 'api' }],
        }),
      ],
      bundle,
      clientStack: emptyClient,
    })
    expect(a.items[0].inferred_from_defaults).toBe(false)
    expect(a.items[0].requires.platform).toEqual(['Next.js 14'])
  })

  it('marks capabilities the client already has as match', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Payments Setup', {
          platform: ['Stripe'],
          integrations: [],
        }),
      ],
      bundle,
      clientStack: {
        builtwith: {
          technologies: [tech('Stripe', 'Payments')],
        },
      },
    })
    const matches = a.items[0].fit.filter((f) => f.kind === 'match')
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ capability: 'payments', our: 'Stripe', client: 'Stripe' })
    expect(a.items[0].effort).toBe('small')
  })

  it('marks gaps and integrations separately; effort scales with gap count', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Automation Setup', {
          platform: ['Next.js 14', 'Supabase (Postgres)'],
          integrations: [
            { system: 'n8n', direction: 'outbound', method: 'webhook' },
            { system: 'Stripe', direction: 'outbound', method: 'api' },
          ],
        }),
      ],
      bundle,
      clientStack: {
        builtwith: {
          technologies: [tech('Stripe', 'Payments')],
        },
      },
    })
    const f = a.items[0].fit
    expect(f.find((x) => x.our === 'Stripe')?.kind).toBe('integrate')
    expect(f.find((x) => x.our === 'n8n')?.kind).toBe('gap')
    expect(f.find((x) => x.our === 'Next.js 14')?.kind).toBe('gap')
    expect(f.find((x) => x.our === 'Supabase (Postgres)')?.kind).toBe('gap')
    // 3 gaps (3*2=6) + 1 integration (+1) = 7 → large
    expect(a.items[0].effort).toBe('large')
  })

  it('scores medium effort for modest integration work', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Integration Only', {
          platform: ['Stripe'],
          integrations: [
            { system: 'n8n', direction: 'outbound', method: 'webhook' },
            { system: 'OpenAI', direction: 'outbound', method: 'api' },
          ],
        }),
      ],
      bundle,
      clientStack: {
        builtwith: { technologies: [tech('Stripe', 'Payments')] },
      },
    })
    // 0 platform gaps, 2 integration gaps (n8n and OpenAI — client doesn't have them) = 2*2 = 4 → medium
    expect(a.items[0].effort).toBe('medium')
  })

  it('emits a replace tradeoff when client uses a different tool in the same category', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Storefront', {
          platform: ['Stripe'],
          integrations: [],
        }),
      ],
      bundle,
      clientStack: {
        builtwith: {
          technologies: [tech('Square', 'Payments')],
        },
      },
    })
    const fitItem = a.items[0].fit.find((f) => f.our === 'Stripe')
    expect(fitItem?.kind).toBe('replace')
    expect(a.open_tradeoffs.length).toBeGreaterThan(0)
    expect(a.overall_feasibility).not.toBe('high')
  })

  it('records BuiltWith credit state based on remaining count', () => {
    const low = buildFeasibilityAssessment({
      proposedItems: [],
      bundle,
      clientStack: emptyClient,
      builtwithCreditsRemaining: 0,
    })
    expect(low.builtwith_credits_state).toBe('exhausted')
    expect(low.builtwith_credits_remaining).toBe(0)

    const ok = buildFeasibilityAssessment({
      proposedItems: [],
      bundle,
      clientStack: emptyClient,
      builtwithCreditsRemaining: 25,
    })
    expect(ok.builtwith_credits_state).toBe('ok')

    const unknown = buildFeasibilityAssessment({
      proposedItems: [],
      bundle,
      clientStack: emptyClient,
    })
    expect(unknown.builtwith_credits_state).toBe('unknown')
    expect(unknown.builtwith_credits_remaining).toBeNull()
  })

  it('propagates merge conflicts to the assessment', () => {
    const a = buildFeasibilityAssessment({
      proposedItems: [service('s1', 'Any')],
      bundle,
      clientStack: {
        audit: { technologies: [tech('WooCommerce', 'Ecommerce')] },
        builtwith: { technologies: [tech('Shopify', 'Ecommerce')] },
      },
    })
    expect(a.conflicts).toHaveLength(1)
    expect(a.client_stack_source).toBe('merged')
  })

  it('produces a stable inputs_hash when nothing changed', () => {
    const input = {
      proposedItems: [service('s1', 'X', { platform: ['Stripe'], integrations: [] })],
      bundle,
      clientStack: emptyClient,
    }
    const a1 = buildFeasibilityAssessment(input)
    const a2 = buildFeasibilityAssessment(input)
    expect(a1.inputs_hash).toBe(a2.inputs_hash)
  })
})

describe('projectForClient', () => {
  it('renders friendly effort and verb labels', () => {
    const snapshot = buildFeasibilityAssessment({
      proposedItems: [
        service('s1', 'Payments', {
          platform: ['Stripe'],
          integrations: [{ system: 'n8n', direction: 'outbound', method: 'webhook' }],
        }),
      ],
      bundle: { id: 'b1' },
      clientStack: {
        builtwith: { technologies: [tech('Stripe', 'Payments')] },
      },
    })
    const view = projectForClient(snapshot)
    expect(view.items).toHaveLength(1)
    expect(view.items[0].works_with).toContain('Stripe')
    expect(view.items[0].we_set_up).toContain('n8n')
    expect(view.estimated_complexity_label).toMatch(/setup|rollout|project/i)
    expect(view.overall_fit_label).toBeTruthy()
  })

  it('renders an empty-state message when item has no fit segments', () => {
    const snapshot = buildFeasibilityAssessment({
      proposedItems: [service('s1', 'Empty', { platform: [], integrations: [] })],
      bundle: { id: 'b1' },
      clientStack: {},
    })
    const view = projectForClient(snapshot)
    expect(view.items[0].fit_summary).toMatch(/delivered entirely on our platform/i)
  })
})
