import sharp from 'sharp'
import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabaseAdmin: null }))
vi.mock('@/lib/agent-work-items', () => ({ createAgentWorkItem: vi.fn() }))
vi.mock('@/lib/playtest-broll', () => ({ captureBroll: vi.fn() }))

import {
  applyApprovedVisualAssetCandidates,
  captureVisualAssetCandidates,
  listVisualAssetCandidates,
  regenerateRejectedVisualAssetCandidate,
  resolveVisualAssetRoute,
  reviewVisualAssetCandidate,
  reviewVisualAssetCandidateQuality,
  scoreImageBuffer,
  visualAssetStoragePath,
} from './visual-assets'
import { captureBroll } from '@/lib/playtest-broll'

function createTableClient(tables: Record<string, Record<string, any>[]>) {
  const updates: Array<{ table: string; patch: Record<string, unknown>; filters: Record<string, unknown> }> = []
  const storageUploads: Array<{ bucket: string; storagePath: string; buffer: Buffer }> = []

  function query(table: string) {
    const state: {
      select?: string
      patch?: Record<string, unknown>
      insert?: Record<string, unknown>
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
      insert(patch: Record<string, unknown>) {
        state.insert = patch
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
        if (state.insert) {
          const row = {
            id: `inserted-${list.length + 1}`,
            ...state.insert,
          }
          list.push(row)
          return Promise.resolve({ data: row, error: null })
        }
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
    storageUploads,
    from: query,
    storage: {
      from(bucket: string) {
        return {
          upload(storagePath: string, buffer: Buffer) {
            storageUploads.push({ bucket, storagePath, buffer })
            return Promise.resolve({ error: null })
          },
          getPublicUrl(storagePath: string) {
            return { data: { publicUrl: `https://cdn.example.com/${bucket}/${storagePath}` } }
          },
        }
      },
    },
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
  beforeEach(() => {
    vi.mocked(captureBroll).mockReset()
  })

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
    })).toMatchObject({ route: '/store/1?visualCapture=1' })

    expect(resolveVisualAssetRoute({
      entityType: 'service',
      entityId: 'svc-1',
      title: 'AI Advisory',
    })).toMatchObject({ route: '/services/svc-1?visualCapture=1' })
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

  it('preserves structured metadata while reviewing candidates', async () => {
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
      recommendation: 'Keep this framing for the homepage.',
      reasonCodes: ['weak_feature_signal'],
      client,
    })

    expect(row).toMatchObject({
      status: 'approved',
      reviewed_by: 'admin-1',
      metadata: {
        score: 10,
        review_reason: 'Strong feature signal',
        review_recommendation: 'Keep this framing for the homepage.',
        review_reason_codes: ['weak_feature_signal'],
        review_feedback: expect.objectContaining({
          status: 'approved',
          reason: 'Strong feature signal',
          recommendation: 'Keep this framing for the homepage.',
          reason_codes: ['weak_feature_signal'],
        }),
      },
    })
  })

  it('creates a regenerated proposed candidate from rejected feedback', async () => {
    const client = createTableClient({
      visual_asset_candidates: [{
        id: 'rejected-1',
        entity_type: 'service',
        entity_id: 'svc-1',
        title: 'AI Advisory',
        theme: 'light',
        current_url: null,
        candidate_url: 'https://example.com/bad.png',
        candidate_storage_path: 'products/visual-candidates/service-svc-1/light/rejected-1.png',
        capture_route: '/services/svc-1?visualCapture=1',
        score: 54,
        reason_codes: ['dark_mode_mismatch'],
        status: 'rejected',
        metadata: {
          source_table: 'services',
          review_feedback: {
            reason: 'Too dark for light mode.',
            recommendation: 'Use a brighter service frame with more feature detail.',
            reason_codes: ['dark_mode_mismatch', 'weak_feature_signal'],
          },
        },
      }],
    }) as any

    const replacement = await regenerateRejectedVisualAssetCandidate({
      sourceCandidateId: 'rejected-1',
      requestedBy: 'admin-1',
      client,
    })

    expect(replacement).toMatchObject({
      id: 'inserted-2',
      status: 'proposed',
      candidate_url: null,
      capture_route: '/services/svc-1?visualCapture=1&visualRevision=1&visualFocus=dark_mode_mismatch%2Cweak_feature_signal',
      reason_codes: ['dark_mode_mismatch', 'weak_feature_signal'],
      metadata: {
        regenerated_from_candidate_id: 'rejected-1',
        previous_candidate_url: 'https://example.com/bad.png',
        regeneration_feedback: expect.objectContaining({
          reason: 'Too dark for light mode.',
          recommendation: 'Use a brighter service frame with more feature detail.',
          reason_codes: ['dark_mode_mismatch', 'weak_feature_signal'],
        }),
      },
    })
  })

  it('rejects regeneration for candidates that are not in the rejected state', async () => {
    const tables = {
      visual_asset_candidates: [{
        id: 'candidate-1',
        status: 'proposed',
      }],
    }
    const client = createTableClient(tables) as any

    await expect(regenerateRejectedVisualAssetCandidate({
      sourceCandidateId: 'candidate-1',
      requestedBy: 'admin-1',
      client,
    })).rejects.toThrow('Only rejected visual asset candidates can be regenerated')

    expect(tables.visual_asset_candidates).toHaveLength(1)
  })

  it.each(['proposed', 'approved'] as const)(
    'blocks regeneration when a %s replacement already exists for the same entity and theme',
    async (openStatus) => {
      const tables = {
        visual_asset_candidates: [
          {
            id: 'rejected-1',
            entity_type: 'service',
            entity_id: 'svc-1',
            title: 'AI Advisory',
            theme: 'dark',
            current_url: null,
            candidate_url: 'https://example.com/rejected.png',
            candidate_storage_path: 'services/visual-candidates/service-svc-1/dark/rejected-1.png',
            capture_route: '/services/svc-1?visualCapture=1',
            score: 42,
            reason_codes: ['candidate_below_quality_bar'],
            status: 'rejected',
            metadata: {},
          },
          {
            id: 'open-1',
            entity_type: 'service',
            entity_id: 'svc-1',
            title: 'AI Advisory',
            theme: 'dark',
            current_url: null,
            candidate_url: null,
            candidate_storage_path: null,
            capture_route: '/services/svc-1?visualCapture=1',
            score: null,
            reason_codes: [],
            status: openStatus,
            metadata: {},
          },
        ],
      }
      const client = createTableClient(tables) as any

      await expect(regenerateRejectedVisualAssetCandidate({
        sourceCandidateId: 'rejected-1',
        requestedBy: 'admin-1',
        client,
      })).rejects.toThrow('An open replacement candidate already exists for this asset and theme')

      expect(tables.visual_asset_candidates).toHaveLength(2)
    },
  )

  it.each([
    {
      label: 'different theme',
      openCandidate: {
        entity_type: 'service',
        entity_id: 'svc-1',
        theme: 'light',
      },
    },
    {
      label: 'different entity',
      openCandidate: {
        entity_type: 'service',
        entity_id: 'svc-2',
        theme: 'dark',
      },
    },
    {
      label: 'different entity type',
      openCandidate: {
        entity_type: 'product',
        entity_id: 'svc-1',
        theme: 'dark',
      },
    },
  ])('allows regeneration when an open candidate has a $label', async ({ openCandidate }) => {
    const tables = {
      visual_asset_candidates: [
        {
          id: 'rejected-1',
          entity_type: 'service',
          entity_id: 'svc-1',
          title: 'AI Advisory',
          theme: 'dark',
          current_url: null,
          candidate_url: 'https://example.com/rejected.png',
          candidate_storage_path: 'services/visual-candidates/service-svc-1/dark/rejected-1.png',
          capture_route: '/services/svc-1?visualCapture=1',
          score: 42,
          reason_codes: ['candidate_below_quality_bar'],
          status: 'rejected',
          metadata: {},
        },
        {
          id: 'open-1',
          ...openCandidate,
          title: 'Another visual candidate',
          current_url: null,
          candidate_url: null,
          candidate_storage_path: null,
          capture_route: '/services/other?visualCapture=1',
          score: null,
          reason_codes: [],
          status: 'proposed',
          metadata: {},
        },
      ],
    }
    const client = createTableClient(tables) as any

    await expect(regenerateRejectedVisualAssetCandidate({
      sourceCandidateId: 'rejected-1',
      requestedBy: 'admin-1',
      client,
    })).resolves.toMatchObject({
      id: 'inserted-3',
      status: 'proposed',
      entity_type: 'service',
      entity_id: 'svc-1',
      theme: 'dark',
    })

    expect(tables.visual_asset_candidates).toHaveLength(3)
  })

  it('filters invalid feedback reason codes before building the regeneration capture route', async () => {
    const client = createTableClient({
      visual_asset_candidates: [{
        id: 'rejected-1',
        entity_type: 'product',
        entity_id: '42',
        title: 'Diagnostic Template',
        theme: 'light',
        current_url: null,
        candidate_url: 'https://example.com/bad.png',
        candidate_storage_path: 'products/visual-candidates/product-42/light/rejected-1.png',
        capture_route: '/store/42?visualCapture=1',
        score: 54,
        reason_codes: ['candidate_below_quality_bar'],
        status: 'rejected',
        metadata: {},
      }],
    }) as any

    const replacement = await regenerateRejectedVisualAssetCandidate({
      sourceCandidateId: 'rejected-1',
      requestedBy: 'admin-1',
      feedback: {
        reason: 'The capture missed the product UI.',
        recommendation: 'Focus the regenerated capture on feature detail.',
        reasonCodes: ['weak_feature_signal', 'not_a_reason_code' as any, 'low_resolution'],
      },
      client,
    })

    expect(replacement).toMatchObject({
      capture_route: '/store/42?visualCapture=1&visualRevision=1&visualFocus=weak_feature_signal%2Clow_resolution',
      reason_codes: ['weak_feature_signal', 'low_resolution'],
      metadata: {
        regeneration_feedback: expect.objectContaining({
          reason_codes: ['weak_feature_signal', 'low_resolution'],
        }),
      },
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

  it('captures only uncaptured proposed candidates and keeps blocked captures out of the human review queue', async () => {
    const screenshotDir = await fs.mkdtemp(path.join(os.tmpdir(), 'visual-assets-test-'))
    const screenshotPath = path.join(screenshotDir, 'visual-candidate-needs-capture.png')
    await sharp({
      create: {
        width: 1440,
        height: 900,
        channels: 3,
        background: '#050505',
      },
    }).png().toFile(screenshotPath)

    vi.mocked(captureBroll).mockResolvedValue({
      screenshots: [screenshotPath],
      videos: [],
      outputDir: screenshotDir,
    } as any)

    const client = createTableClient({
      visual_asset_candidates: [
        {
          id: 'needs-capture',
          entity_type: 'product',
          entity_id: '42',
          title: 'Light store card',
          theme: 'light',
          current_url: null,
          candidate_url: null,
          candidate_storage_path: null,
          capture_route: '/store/42?visualCapture=1',
          score: null,
          reason_codes: ['missing_image'],
          status: 'proposed',
          metadata: { source_table: 'products' },
          created_at: '2026-06-30T10:00:00.000Z',
          updated_at: '2026-06-30T10:00:00.000Z',
        },
        {
          id: 'already-captured',
          entity_type: 'product',
          entity_id: '43',
          title: 'Already captured',
          theme: 'dark',
          current_url: null,
          candidate_url: 'https://example.com/already.png',
          candidate_storage_path: 'products/visual-candidates/product-43/dark/already-captured.png',
          capture_route: '/store/43?visualCapture=1',
          score: 88,
          reason_codes: [],
          status: 'proposed',
          metadata: {},
          created_at: '2026-06-30T11:00:00.000Z',
          updated_at: '2026-06-30T11:00:00.000Z',
        },
        {
          id: 'failed-needs-retry',
          entity_type: 'service',
          entity_id: 'svc-1',
          title: 'Failed service',
          theme: 'dark',
          current_url: null,
          candidate_url: null,
          candidate_storage_path: null,
          capture_route: '/services/svc-1?visualCapture=1',
          score: 0,
          reason_codes: ['image_load_failure'],
          status: 'failed',
          metadata: {},
          created_at: '2026-06-30T12:00:00.000Z',
          updated_at: '2026-06-30T12:00:00.000Z',
        },
      ],
    }) as any

    const result = await captureVisualAssetCandidates({
      client,
      baseUrl: 'https://portfolio.example.com',
      noStartServer: true,
    })

    expect(captureBroll).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'https://portfolio.example.com',
      noStartServer: true,
      routes: [expect.objectContaining({
        route: '/store/42?visualCapture=1&visualFocus=missing_image',
        filename: 'visual-candidate-needs-capture',
        colorScheme: 'light',
      })],
    }))
    expect(client.storageUploads).toEqual([expect.objectContaining({
      bucket: 'products',
      storagePath: 'products/visual-candidates/product-42/light/needs-capture.png',
    })])
    expect(result).toMatchObject({ captured: 1, passed: 0, blocked: 1 })
    expect(result.candidates[0]).toMatchObject({
      id: 'needs-capture',
      status: 'failed',
      candidate_url: 'https://cdn.example.com/products/products/visual-candidates/product-42/light/needs-capture.png',
      metadata: {
        source_table: 'products',
        agent_review: expect.objectContaining({
          decision: 'blocked',
          reason_codes: expect.arrayContaining(['dark_mode_mismatch']),
        }),
      },
    })

    await expect(listVisualAssetCandidates({
      status: 'proposed',
      candidateState: 'captured',
      client,
    })).resolves.toEqual([expect.objectContaining({ id: 'already-captured' })])
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
