import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildModelUsageImportPlan } from './model-usage'
import { buildModelUsageImportPacketFromRequest, buildModelUsageImportPacketFromSourceText, type ModelUsageSourceFileKind } from './model-usage-source-readers'

const fixtureDir = join(process.cwd(), 'docs/model-usage-import-fixtures')

function fixture(name: string) {
  return readFileSync(join(fixtureDir, name), 'utf8')
}

describe('model usage import fixtures', () => {
  it.each([
    ['codex_session_json', 'codex-session.json', 'codex_session_import'],
    ['claude_code_session_json', 'claude-code-session.json', 'claude_code_session_import'],
    ['gemini_usage_csv', 'gemini-usage.csv', 'gemini_usage_export'],
    ['openai_usage_jsonl', 'openai-usage.jsonl', 'openai_usage_export'],
    ['anthropic_usage_jsonl', 'anthropic-usage.jsonl', 'anthropic_usage_export'],
    ['local_model_json', 'local-open-weight-run.json', 'open_weight_model_usage_import'],
  ] as Array<[ModelUsageSourceFileKind, string, string]>)('parses %s fixture', (kind, fileName, sourceType) => {
    const packet = buildModelUsageImportPacketFromSourceText({
      kind,
      text: fixture(fileName),
      clientLabel: 'Portfolio',
      exportBatchId: 'fixture-batch',
    })
    const plan = buildModelUsageImportPlan(packet, '2026-07-13T14:00:00.000Z')

    expect(plan.eventRows).toHaveLength(1)
    expect(plan.eventRows[0]).toMatchObject({
      source_type: sourceType,
      scrubbed: true,
    })
    expect(plan.eventRows[0].total_tokens).toBeGreaterThan(0)
  })

  it('validates the reviewed source files request fixture as dry-run only', () => {
    const request = JSON.parse(fixture('reviewed-source-files-request.json'))
    const packet = buildModelUsageImportPacketFromRequest(request)
    const plan = buildModelUsageImportPlan(packet, '2026-07-13T14:00:00.000Z')

    expect(plan.dryRun).toBe(true)
    expect(plan.eventRows).toHaveLength(6)
    expect(plan.subscriptionAllocationRows).toHaveLength(1)
    expect(plan.eventRows.map((row) => row.source_type)).toEqual([
      'codex_session_import',
      'claude_code_session_import',
      'gemini_usage_export',
      'openai_usage_export',
      'anthropic_usage_export',
      'open_weight_model_usage_import',
    ])
    expect(plan.warnings).toEqual([])
  })
})
