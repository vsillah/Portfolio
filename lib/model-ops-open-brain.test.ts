import { mkdir, mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getModelOpsProjection } from './model-ops-open-brain'

let tempRoot: string | null = null

async function makeModelOpsRoot() {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'model-ops-open-brain-'))
  await mkdir(path.join(tempRoot, 'reports'), { recursive: true })
  await writeFile(path.join(tempRoot, 'reports/latest-dashboard-data.json'), JSON.stringify({
    projectName: 'Local LLM Model Ops & Hermes Automation',
    generatedAt: '2026-05-04T13:11:08.027Z',
    recommendations: {
      productionGate: 'No public production swap should occur without explicit approval.',
    },
    replyRuns: [
      {
        file: 'eval-results/reply-intent-review/qwen3-4b.json',
        model: 'qwen3-4b-instruct-2507',
        scored: 211,
        correct: 211,
        accuracy: 1,
        avgLatencyMs: 353,
        status: 'fixture_pipeline_timing_only',
      },
      {
        file: 'eval-results/reply-intent-review/qwen3-coder.json',
        model: 'qwen/qwen3-coder-30b',
        scored: 211,
        correct: 209,
        accuracy: 0.99,
        avgLatencyMs: 635,
        status: 'fixture_pipeline_timing_only',
      },
    ],
    ragRuns: [
      {
        file: 'rag/routed.json',
        name: 'Routed local',
        generatedAt: '2026-05-04T12:00:00.000Z',
        totalQueries: 67,
        overall: {
          local: { sufficient: 21, partial: 39, weak: 7 },
          local_better: 33,
          local_same: 31,
          local_worse: 3,
        },
      },
    ],
    swapRequests: [],
  }, null, 2))
  await writeFile(path.join(tempRoot, 'reports/open-source-model-evaluation-swap-monitor-2026-05-04.md'), '# Monitor\n')
  await writeFile(path.join(tempRoot, 'cultural-preservation-resource-evaluation-framework.md'), '# Framework\n')
  return tempRoot
}

afterEach(async () => {
  if (tempRoot) {
    await import('fs/promises').then(({ rm }) => rm(tempRoot as string, { recursive: true, force: true }))
    tempRoot = null
  }
  vi.unstubAllEnvs()
})

describe('Model Ops Open Brain projection', () => {
  it('normalizes benchmark reports into unified router decisions', async () => {
    const root = await makeModelOpsRoot()
    const projection = await getModelOpsProjection(root)

    expect(projection.available).toBe(true)
    expect(projection.currentLocalDefault).toBe('qwen3-4b-instruct-2507')
    expect(projection.currentFrontierFallback).toBe('frontier_cloud')
    expect(projection.benchmarkResults).toHaveLength(2)
    expect(projection.ragQualityRuns[0]).toEqual(expect.objectContaining({
      name: 'Routed local',
      totalQueries: 67,
      localBetter: 33,
      localWorse: 3,
    }))
    expect(projection.routerDecisions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        recordType: 'router_decision',
        taskClass: 'reply_intent_classification',
        executionLane: 'local',
        selectedRuntime: 'local:qwen3-4b-instruct-2507',
      }),
      expect.objectContaining({
        taskClass: 'portfolio_rag_retrieval',
        executionLane: 'hybrid',
        fallbackRuntime: 'Pinecone/OpenAI fallback',
        approvalState: 'shadow_only',
      }),
      expect.objectContaining({
        taskClass: 'production_model_swap',
        executionLane: 'approval_required',
        approvalState: 'approval_required',
      }),
      expect.objectContaining({
        taskClass: 'sensitive_corpus_cultural_preservation',
        executionLane: 'approval_required',
      }),
    ]))
  })

  it('returns a safe unavailable projection when reports are missing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'model-ops-empty-'))
    tempRoot = root
    const projection = await getModelOpsProjection(root)

    expect(projection.available).toBe(false)
    expect(projection.routerDecisions).toEqual([])
    expect(projection.reason).toContain('Model Ops dashboard data was not found')
  })

  it('falls back to the repo-owned sanitized snapshot when no local Model Ops home is configured', async () => {
    vi.stubEnv('MODEL_OPS_FORCE_REPO_SNAPSHOT', '1')
    const projection = await getModelOpsProjection()

    expect(projection.available).toBe(true)
    expect(projection.sourceRoot).toContain('data/model-ops')
    expect(projection.currentLocalDefault).toBe('qwen3-4b-instruct-2507')
    expect(projection.routerDecisions.length).toBeGreaterThan(0)
    expect(projection.monitor.cadence).toContain('repo snapshot fallback')
  })
})
