import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn() }))
vi.mock('@/lib/playtest-broll', () => ({ captureBroll: vi.fn() }))

import {
  applyApprovedVisualAssetCandidates,
  listVisualAssetCandidates,
  resolveVisualAssetRoute,
  reviewVisualAssetCandidate,
  reviewVisualAssetCandidateQuality,
  scoreImageBuffer,
  visualAssetStoragePath,
} from './visual-assets'

function createTableClient(tables: Record<string, Record<string, any>[]>) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; filters: Record<string, unknown> }> = []

  function query(table: string) {
    const state: {
      select?: string
      patch?: Record<string, unknown>
      filters: Record<string, unknown>
      inFilters: Record<string, unknown[]>
      notFilters: Record<string, unknown>
      isFilters: Record<string, unknown>
    } = { filters: {}, inFilters: {}, notFilters: {}, isFilters: {} }

    const api: any = {
      select(value?: string) {
        state.select = value
        return api
      },
      update(patch: Record<string, unknown>) {
        state.patch = patch
        return api
      },
      eq(key: string, value: unknown) {
        state.filters[key] = value
        return api
      },
      in(key: string, value: unknown[]) {
        state.inFilters[key] = value
        return api
      },
      not(key: string, _operator: string, value: unknown) {
        state.notFilters[key] = value
        return api
      },
      is(key: string, value: unknown) {
        state.isFilters[key] = value
        return api
      },
      order() {
        return api
      },
      limit() {
        return api
      },
      maybeSingle() {
        const row = (tables[table] ?? []).find((entry) => matches(entry, state))
        return Promise.resolve({ data: row ?? null, error: null })
      },
      single() {
        const list = tables[table] ?? []
        const row = list.find((entry) => matches(entry, state))
        if (state.patch && row) {
          Object.assign(row, state.patch)
          updates.push({ table, patch: state.patch, filters: state.filters })
          return Promise.resolve({ data: row, error: null })
        }
        return Promise.resolve({ data: row ?? null, error: row ? null : { message: 'missing row' } })
      },
      then(resolve: (value: unknown) => void) {
        const rows = (tables[table] ?? []).filter((entry) => matches(entry, state))
        if (state.patch) {
          rows.forEach((row) => Object.assign(row, state.patch))
          updates.push({ table, patch: state.patch, filters: state.filters })
        }
        resolve({ data: rows, error: null })
      },
    }
    return api
  }

  return {
    updates,
    from: query,
  }
}

function matches(row: Record<string, unknown>, state: {
  filters: Record<string, unknown>
  inFilters: Record<string, unknown[]>
  notFilters: Record<string, unknown>
  isFilters: Record<string, unknown>
}) {
  for (const [key, value] of Object.entries(state.filters)) {
    if (row[key] !== value) return false
  }
  for (const [key, values] of Object.entries(state.inFilters)) {
    if (!values.includes(row[key])) return false
  }
  for (const [key, value] of Object.entries(state.notFilters)) {
    if (row[key] === value || row[key] == null) return false
  }
  for (const [key, value] of Object.entries(state.isFilters)) {
    if (value === null) {
      if (row[key] != null) return false
    } else if (row[key] !== value) {
      return false
    }
  }
  return true
}

describe('visual asset helpers', () => {
  it('resolves theme-scoped storage paths', () => {
    expect(visualAssetStoragePath({
      entityType: 'product',
      entityId: '42',
      theme: 'dark',
      candidateId: 'candidate-1',
    })).toBe('products/visual-candidates/product-42/dark/candidate-1.png')

    expect(visualAssetStoragePath({
      entityType: 'prototype',
      entityId: 'proto-1',
      theme: 'light',
      candidateId: 'candidate-2',
    })).toBe('prototypes/proto-1/visual-candidates/light/candidate-2.png')
  })

  it('resolves product and service capture routes', () => {
    expect(resolveVisualAssetRoute({
      entityType: 'product',
      entityId: '1',
      title: 'Diagnostic Template',
      type: 'template',
    })).toMatchObject({ route: '/tools/audit' })

    expect(resolveVisualAssetRoute({
      entityType: 'service',
      entityId: 'svc-1',
      title: 'AI Advisory',
    })).toMatchObject({ route: '/services/svc-1' })
  })

  it('scores blank light screenshots with deterministic reason codes', async () => {
    const buffer = await sharp({
      create: {
        width: 640,
        height: 360,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer()

    const score = await scoreImageBuffer(buffer)
    expect(score.reasonCodes).toEqual(expect.arrayContaining([
      'low_resolution',
      'high_blank_space_ratio',
      'light_mode_mismatch',
      'weak_feature_signal',
    ]))
    expect(score.metadata.darkPixelRatio).toBe(0)
  })

  it('blocks dark-looking captures for light theme review before human approval', () => {
    const review = reviewVisualAssetCandidateQuality({
      title: 'Light candidate',
      theme: 'light',
    }, {
      score: 82,
      reasonCodes: [],
      metadata: {
        width: 1440,
        height: 900,
        aspectRatio: 1.6,
        blankSpaceRatio: 0.2,
        lightPixelRatio: 0.04,
        darkPixelRatio: 0.82,
        edgeDensity: 0.12,
      },
    }, '2026-06-30T12:00:00.000Z')

    expect(review).toMatchObject({
      reviewer: 'portfolio-visual-curator',
      decision: 'blocked',
      reason_codes: expect.arrayContaining(['dark_mode_mismatch']),
    })
  })

  it('passes a strong theme-matched capture to the human approval queue', () => {
    const review = reviewVisualAssetCandidateQuality({
      title: 'Dark candidate',
      theme: 'dark',
    }, {
      score: 88,
      reasonCodes: [],
      metadata: {
        width: 1440,
        height: 900,
        aspectRatio: 1.6,
        blankSpaceRatio: 0.18,
        lightPixelRatio: 0.18,
        darkPixelRatio: 0.42,
        edgeDensity: 0.14,
      },
    }, '2026-06-30T12:00:00.000Z')

    expect(review).toMatchObject({
      decision: 'passed',
      reason_codes: [],
      requirements: { minimum_score: 70, expected_theme: 'dark' },
    })
  })

  it('preserves metadata while approving and rejecting candidates', async () => {
    const client = createTableClient({
      visual_asset_candidates: [{
        id: 'candidate-1',
        status: 'proposed',
        metadata: { score: 10 },
      }],
    }) as any

    const row = await reviewVisualAssetCandidate({
      id: 'candidate-1',
      status: 'approved',
      reviewedBy: 'admin-1',
      reason: 'Strong feature signal',
      client,
    })

    expect(row).toMatchObject({
      status: 'approved',
      reviewed_by: 'admin-1',
      metadata: { score: 10, review_reason: 'Strong feature signal' },
    })
  })

  it('separates captured review candidates from the missing-capture queue', async () => {
    const client = createTableClient({
      visual_asset_candidates: [
        {
          id: 'captured-1',
          status: 'proposed',
          candidate_url: 'https://example.com/captured.png',
        },
        {
          id: 'needs-capture-1',
          status: 'proposed',
          candidate_url: null,
        },
        {
          id: 'approved-captured',
          status: 'approved',
          candidate_url: 'https://example.com/approved.png',
        },
      ],
    }) as any

    await expect(listVisualAssetCandidates({
      status: 'proposed',
      candidateState: 'captured',
      client,
    })).resolves.toEqual([expect.objectContaining({ id: 'captured-1' })])

    await expect(listVisualAssetCandidates({
      status: 'proposed',
      candidateState: 'needs_capture',
      client,
    })).resolves.toEqual([expect.objectContaining({ id: 'needs-capture-1' })])
  })

  it('applies approved candidates to theme variants without overwriting light and dark together', async () => {
    const client = createTableClient({
      visual_asset_candidates: [{
        id: 'candidate-1',
        entity_type: 'product',
        entity_id: '42',
        title: 'Product',
        theme: 'light',
        current_url: null,
        candidate_url: 'https://example.com/light.png',
        candidate_storage_path: 'products/visual-candidates/product-42/light/candidate-1.png',
        capture_route: '/store',
        score: 88,
        reason_codes: [],
        status: 'approved',
        metadata: {},
      }],
      products: [{
        id: '42',
        image_url: 'https://example.com/dark.png',
        image_variants: { dark: 'https://example.com/dark.png' },
      }],
    }) as any

    const result = await applyApprovedVisualAssetCandidates({ client })

    expect(result).toMatchObject({ applied: 1, failed: 0 })
    expect(client.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'products',
        patch: expect.objectContaining({
          image_variants: {
            dark: 'https://example.com/dark.png',
            light: 'https://example.com/light.png',
          },
        }),
      }),
    ]))
    expect(client.updates.some((update: any) => update.patch.image_url === 'https://example.com/light.png')).toBe(false)
  })
})
