import { describe, expect, it } from 'vitest'
import {
  buildModelOpsResearchPlan,
  MODEL_OPS_RESEARCH_APPROVAL_TYPE,
  requiresModelOpsApproval,
} from './model-ops-research'
import type { ModelOpsProjection } from './model-ops-open-brain'

function projection(overrides: Partial<ModelOpsProjection> = {}): ModelOpsProjection {
  return {
    available: true,
    generatedAt: '2026-05-04T13:11:08.027Z',
    projectName: 'Local LLM Model Ops & Hermes Automation',
    sourceRoot: 'data/model-ops',
    reason: null,
    currentLocalDefault: 'qwen3-4b-instruct-2507',
    currentFrontierFallback: 'frontier_cloud',
    currentEmbeddingModel: 'text-embedding-nomic-embed-text-v1.5',
    monitor: {
      name: 'Open Source Model Evaluation and Swap Monitor',
      cadence: 'weekly Monday 8 AM',
      latestReportPath: null,
      productionGate: 'Approval required.',
    },
    routerDecisions: [
      {
        id: 'router_decision:reply_intent_classification',
        recordType: 'router_decision',
        taskClass: 'reply_intent_classification',
        selectedRuntime: 'local:qwen3-4b-instruct-2507',
        fallbackRuntime: 'frontier_cloud',
        executionLane: 'local',
        confidence: 0.78,
        evidenceSource: '211 scored reply-intent examples; fixture timing only.',
        approvalState: 'approved_policy',
        reason: 'Low-risk classification can run locally.',
        linkedRecordIds: ['model_ops.benchmark_result:reply_intent:qwen3-4b-instruct-2507'],
        sourcePath: 'data/model-ops/reports/latest-dashboard-data.json',
        sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
        fingerprint: 'reply',
      },
      {
        id: 'router_decision:portfolio_rag_retrieval',
        recordType: 'router_decision',
        taskClass: 'portfolio_rag_retrieval',
        selectedRuntime: 'local:Routed local',
        fallbackRuntime: 'Pinecone/OpenAI fallback',
        executionLane: 'hybrid',
        confidence: 0.54,
        evidenceSource: '67 retrieval judgments; answer-level eval is still required.',
        approvalState: 'shadow_only',
        reason: 'Fallback remains required.',
        linkedRecordIds: ['model_ops.rag_quality_run:routed-local'],
        sourcePath: 'data/model-ops/reports/latest-dashboard-data.json',
        sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
        fingerprint: 'rag',
      },
      {
        id: 'router_decision:production_model_swap',
        recordType: 'router_decision',
        taskClass: 'production_model_swap',
        selectedRuntime: 'none',
        fallbackRuntime: 'frontier_cloud',
        executionLane: 'approval_required',
        confidence: 1,
        evidenceSource: 'Production gate requires dated approval packet.',
        approvalState: 'approval_required',
        reason: 'Production-facing defaults cannot change silently.',
        linkedRecordIds: [],
        sourcePath: 'data/model-ops/reports/latest-dashboard-data.json',
        sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
        fingerprint: 'swap',
      },
    ],
    candidates: [],
    benchmarkResults: [
      {
        id: 'model_ops.benchmark_result:reply_intent:qwen3-4b-instruct-2507',
        recordType: 'model_ops.benchmark_result',
        task: 'reply_intent',
        model: 'qwen3-4b-instruct-2507',
        score: 1,
        latencyMs: 353,
        sampleCount: 211,
        confidenceStatus: 'fixture_pipeline_timing_only',
        sourcePath: 'eval-results/reply.json',
        sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
        routerDecisionIds: ['router_decision:reply_intent_classification'],
        fingerprint: 'bench',
      },
    ],
    ragQualityRuns: [
      {
        id: 'model_ops.rag_quality_run:routed-local',
        recordType: 'model_ops.rag_quality_run',
        name: 'Routed local',
        totalQueries: 67,
        localSufficient: 21,
        localPartial: 39,
        localWeak: 7,
        localBetter: 33,
        localSame: 31,
        localWorse: 3,
        sourcePath: 'rag/routed.json',
        sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
        routerDecisionIds: ['router_decision:portfolio_rag_retrieval'],
        fingerprint: 'rag-run',
      },
    ],
    swapRequests: [],
    culturalResourceReviews: [],
    ...overrides,
  }
}

describe('buildModelOpsResearchPlan', () => {
  it('uses benchmark monitor metrics to propose the next eval iterations', () => {
    const plan = buildModelOpsResearchPlan({
      generatedAt: '2026-05-12T12:00:00.000Z',
      projection: projection(),
    })

    expect(plan.approvalType).toBe(MODEL_OPS_RESEARCH_APPROVAL_TYPE)
    expect(plan.proposals.map((proposal) => proposal.id)).toEqual(expect.arrayContaining([
      'reply-intent-reviewed-example-expansion',
      'rag-retrieval-judgment-expansion',
      'answer-level-chatbot-eval-harness',
      'production-swap-readiness-packet',
    ]))
    expect(plan.proposals.find((proposal) => proposal.id === 'reply-intent-reviewed-example-expansion')).toMatchObject({
      riskLevel: 'low',
      approvalState: 'not_required',
      nextMetricGate: expect.stringContaining('200+ comparable reviewed real examples'),
    })
    expect(plan.proposals.find((proposal) => proposal.id === 'production-swap-readiness-packet')).toMatchObject({
      riskLevel: 'high',
      approvalState: 'approval_required',
    })
  })

  it('does not propose reply-intent expansion once reviewed metric gate is satisfied', () => {
    const plan = buildModelOpsResearchPlan({
      projection: projection({
        benchmarkResults: [
          {
            id: 'model_ops.benchmark_result:reply_intent:qwen3-4b-instruct-2507',
            recordType: 'model_ops.benchmark_result',
            task: 'reply_intent',
            model: 'qwen3-4b-instruct-2507',
            score: 0.98,
            latencyMs: 353,
            sampleCount: 220,
            confidenceStatus: 'reviewed_real_examples',
            sourcePath: 'eval-results/reply.json',
            sourceGeneratedAt: '2026-05-04T13:11:08.027Z',
            routerDecisionIds: ['router_decision:reply_intent_classification'],
            fingerprint: 'bench',
          },
        ],
      }),
    })

    expect(plan.proposals.map((proposal) => proposal.id)).not.toContain('reply-intent-reviewed-example-expansion')
  })
})

describe('requiresModelOpsApproval', () => {
  it('detects production routing changes as approval-gated', () => {
    expect(requiresModelOpsApproval({ touchedSettings: ['production model default'] })).toBe(true)
    expect(requiresModelOpsApproval({ touchedSettings: ['hosted provider routing'] })).toBe(true)
    expect(requiresModelOpsApproval({ touchedSettings: [] })).toBe(false)
  })
})
