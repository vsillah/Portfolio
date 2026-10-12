import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ collectLiveSocialTopicCoverage: vi.fn() }))
vi.mock('@/lib/social-topic-source-coverage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/social-topic-source-coverage')>()
  return { ...actual, collectLiveSocialTopicCoverage: mocks.collectLiveSocialTopicCoverage }
})
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/social-topic-backlog', () => ({ collectSocialTopicSignals: vi.fn() }))

import { GET } from './route'
import { buildLiveCoverage } from '@/lib/social-topic-source-coverage'
import { buildApprovedSourceProjection } from '@/lib/social-topic-source-receipts'
import { approvedPublicMomentumProjectionsFromResearchPackets } from '@/lib/social-trend-work-join'
import { approvedRepositoryEvidenceProjections } from '@/lib/social-repository-evidence'

const at = '2026-10-12T16:00:00.000Z'

describe('source coverage cron direct collector reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'cron-secret'
  })

  it('reports Dark Castle direct GitHub activity and a Jev momentum/work join without Agent Ops receipts', async () => {
    const githubReceipt = buildApprovedSourceProjection({
      sourceGroup: 'github_development', sourceKind: 'github_pull_request_activity', sourceId: 'github:dark-castle:pulls', productIdentity: 'dark_castle_chess',
      lifecycleStage: 'in_development', label: 'Dark Castle Chess', approvedSummary: 'Dark Castle Chess has current public pull-request activity.',
      privacyClassification: 'public_safe', provenance: 'github_public_api:vsillah/Dark-Castle-Chess:pulls', approvedAt: at, approvedBy: 'github_public_api', observedAt: at,
      evidenceUrl: 'https://github.com/vsillah/Dark-Castle-Chess/pulls', metadata: { collector: 'github_public_api_read_only', topic_identities: ['chess_product_development'] },
    })
    const momentum = approvedPublicMomentumProjectionsFromResearchPackets([{
      id: 'jev-public-source', status: 'approved', source_url: 'https://news.example.com/jev', platform: 'other', title: 'Jev public momentum', retrieved_at: at,
      actor_metadata: {
        operator_review: { decision: 'approved', reviewed_at: at, reviewed_by: 'reviewer' },
        topic_momentum_receipt: {
          approval_status: 'approved', raw_content_included: false, privacy_classification: 'public_safe', momentum_kind: 'public_news',
          approved_summary: 'Approved public momentum around governed capability analysis.', product_identity: 'jev', product_label: 'Jev',
          topic_identities: ['governed_capability_analysis'], approved_at: at, approved_by: 'reviewer', publisher: 'Fixture news',
        },
      },
    }]).projections
    const report = buildLiveCoverage({ generatedAt: at, receipts: [githubReceipt, ...momentum, ...approvedRepositoryEvidenceProjections(at)] })
    mocks.collectLiveSocialTopicCoverage.mockResolvedValue(report)

    const response = await GET(new NextRequest('http://localhost/api/cron/social-topic-source-coverage', {
      headers: { authorization: 'Bearer cron-secret' },
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({
      review_only: true,
      github_activity_product_identities: ['dark_castle_chess'],
      trend_work_product_identities: ['jev'],
      side_effects: {
        github_write: false, provider_generation: false, upload: false, draft_creation: false,
        schedule: false, publish: false, external_send: false,
      },
    })
    expect(report.receipts.some((receipt) => receipt.source_kind === 'agent_work_item_github')).toBe(false)
    expect(report.trend_work_relevance?.candidates[0].source_receipt_ids).toHaveLength(3)
  })
})
