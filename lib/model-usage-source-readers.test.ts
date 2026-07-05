import { describe, expect, it } from 'vitest'
import { buildModelUsageImportPlan } from './model-usage'
import { buildModelUsageImportPacketFromRequest, buildModelUsageImportPacketFromSourceText } from './model-usage-source-readers'

describe('buildModelUsageImportPacketFromSourceText', () => {
  it('turns reviewed Codex session JSON into source packets', () => {
    const packet = buildModelUsageImportPacketFromSourceText({
      kind: 'codex_session_json',
      clientLabel: 'Portfolio',
      agentKey: 'shaka',
      text: JSON.stringify({
        session_id: 'codex-session-1',
        occurred_at: '2026-07-04T12:00:00.000Z',
        model: 'gpt-5-codex',
        task_category: 'coding',
        usage: {
          input_tokens: 12000,
          output_tokens: 1800,
          cached_tokens: 400,
        },
        operation: 'model_usage_source_reader',
      }),
    })

    expect(packet).toMatchObject({
      dryRun: true,
      sourcePackets: [{
        kind: 'codex_session',
        sourceId: 'codex-session-1',
        clientLabel: 'Portfolio',
        agentKey: 'shaka',
        inputTokens: 12000,
        outputTokens: 1800,
        cachedTokens: 400,
      }],
    })

    const plan = buildModelUsageImportPlan(packet, '2026-07-04T13:00:00.000Z')
    expect(plan.eventRows[0]).toMatchObject({
      provider: 'codex',
      runtime: 'codex',
      total_tokens: 14200,
      source_type: 'codex_session_import',
    })
  })

  it('turns Gemini CSV export rows into metered API source packets', () => {
    const packet = buildModelUsageImportPacketFromSourceText({
      kind: 'gemini_usage_csv',
      exportBatchId: 'gemini-export-202607',
      text: [
        'id,timestamp,model,task_category,input_tokens,output_tokens,cost_usd',
        'gemini-row-1,2026-07-04T12:00:00.000Z,gemini-2.5-flash,research,"1,000",200,0.01',
      ].join('\n'),
    })

    expect(packet.sourcePackets?.[0]).toMatchObject({
      kind: 'gemini_usage_export',
      sourceId: 'gemini-row-1',
      model: 'gemini-2.5-flash',
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.01,
      exportBatchId: 'gemini-export-202607',
    })
  })

  it('turns OpenAI JSONL export rows into reviewed source packets', () => {
    const packet = buildModelUsageImportPacketFromSourceText({
      kind: 'openai_usage_jsonl',
      clientProjectId: 'client-1',
      clientLabel: 'Acme',
      text: [
        JSON.stringify({
          id: 'openai-row-1',
          occurred_at: '2026-07-04T12:00:00.000Z',
          model: 'gpt-4o-mini',
          prompt_tokens: 1000,
          completion_tokens: 200,
          cost_usd: 0.004,
          operation: 'research_summary',
        }),
      ].join('\n'),
    })

    expect(packet.sourcePackets?.[0]).toMatchObject({
      kind: 'openai_usage_export',
      sourceId: 'openai-row-1',
      clientProjectId: 'client-1',
      clientLabel: 'Acme',
      inputTokens: 1000,
      outputTokens: 200,
      costUsd: 0.004,
    })
  })

  it('captures local and open-weight deployment hints without storing prompts', () => {
    const packet = buildModelUsageImportPacketFromSourceText({
      kind: 'local_model_json',
      defaultTaskCategory: 'rag',
      text: JSON.stringify([{
        id: 'local-run-1',
        provider: 'open-weight',
        model: 'llama-3.1-8b',
        input_tokens: 3000,
        output_tokens: 500,
        execution_host: 'mac-mini',
        deployment_target: 'local_device',
      }]),
    })

    expect(packet.sourcePackets?.[0]).toMatchObject({
      kind: 'open_weight_model_run',
      sourceId: 'local-run-1',
      model: 'llama-3.1-8b',
      taskCategory: 'rag',
      executionHost: 'mac-mini',
      deploymentTarget: 'local_device',
    })
  })

  it('rejects raw prompts, messages, transcripts, credentials, and oversized batches', () => {
    expect(() => buildModelUsageImportPacketFromSourceText({
      kind: 'codex_session_json',
      text: JSON.stringify({ session_id: 'bad', rawPrompt: 'private prompt' }),
    })).toThrow(/not allowed/)

    expect(() => buildModelUsageImportPacketFromSourceText({
      kind: 'openai_usage_jsonl',
      text: JSON.stringify({ id: 'bad', messages: [{ role: 'user', content: 'private' }] }),
    })).toThrow(/not allowed/)

    expect(() => buildModelUsageImportPacketFromSourceText({
      kind: 'local_model_json',
      text: JSON.stringify(Array.from({ length: 101 }, (_, index) => ({ id: `row-${index}` }))),
    })).toThrow(/more than 100/)
  })

  it('merges source files with reviewed source packets in import requests', () => {
    const packet = buildModelUsageImportPacketFromRequest({
      dryRun: true,
      sourcePackets: [{
        kind: 'codex_session',
        sourceId: 'reviewed-packet-1',
        inputTokens: 100,
        outputTokens: 20,
      }],
      sourceFiles: [{
        kind: 'anthropic_usage_jsonl',
        text: JSON.stringify({
          id: 'anthropic-row-1',
          model: 'claude-3-5-sonnet-20241022',
          input_tokens: 200,
          output_tokens: 40,
        }),
      }],
    })

    expect(packet.sourcePackets).toHaveLength(2)
    expect(packet.sourcePackets?.map((sourcePacket) => sourcePacket.sourceId)).toEqual([
      'reviewed-packet-1',
      'anthropic-row-1',
    ])
  })
})
