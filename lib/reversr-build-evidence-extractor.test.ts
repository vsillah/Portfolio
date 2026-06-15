import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { extractReversrTokenUsage, parseCodexSessionFile } from './reversr-build-evidence-extractor'

let tmpDir: string

function writeJsonl(relativePath: string, rows: unknown[]) {
  const filePath = path.join(tmpDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, rows.map((row) => JSON.stringify(row)).join('\n'))
  return filePath
}

function tokenCount(total: number, input = total - 10, output = 10) {
  return {
    timestamp: '2026-06-15T12:00:00.000Z',
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: {
          input_tokens: input,
          cached_input_tokens: Math.floor(input / 2),
          output_tokens: output,
          reasoning_output_tokens: 3,
          total_tokens: total,
        },
      },
      rate_limits: { plan_type: 'pro' },
    },
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reversr-evidence-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('parseCodexSessionFile', () => {
  it('uses the final cumulative token_count event in a session', async () => {
    const filePath = writeJsonl('2026/06/15/strict.jsonl', [
      {
        timestamp: '2026-06-15T11:00:00.000Z',
        type: 'session_meta',
        payload: {
          id: 'session-1',
          cwd: '/Users/vambahsillah/Documents/ReversR',
          model_provider: 'openai',
        },
      },
      { timestamp: '2026-06-15T11:00:01.000Z', type: 'turn_context', payload: { model: 'gpt-5.5' } },
      tokenCount(100, 90, 10),
      tokenCount(250, 230, 20),
    ])

    const parsed = await parseCodexSessionFile(filePath)

    expect(parsed.strictWorkspaceMatch).toBe(true)
    expect(parsed.totalTokens).toBe(250)
    expect(parsed.inputTokens).toBe(230)
    expect(parsed.outputTokens).toBe(20)
    expect(parsed.reasoningTokens).toBe(3)
    expect(parsed.model).toBe('gpt-5.5')
    expect(parsed.planType).toBe('pro')
  })
})

describe('extractReversrTokenUsage', () => {
  it('excludes broad keyword matches from client-facing strict attribution', async () => {
    writeJsonl('strict/reversr.jsonl', [
      {
        timestamp: '2026-06-15T11:00:00.000Z',
        type: 'session_meta',
        payload: { id: 'strict', cwd: '/Users/vambahsillah/Documents/ReversR' },
      },
      tokenCount(300, 270, 30),
    ])
    writeJsonl('supporting/portfolio.jsonl', [
      {
        timestamp: '2026-06-15T12:00:00.000Z',
        type: 'session_meta',
        payload: { id: 'supporting', cwd: '/Users/vambahsillah/Projects/Portfolio' },
      },
      { timestamp: '2026-06-15T12:00:01.000Z', type: 'response_item', payload: { text: 'ReversR is mentioned here.' } },
      tokenCount(700, 680, 20),
    ])

    const summary = await extractReversrTokenUsage({ sessionsRoot: tmpDir })

    expect(summary.sessionCount).toBe(1)
    expect(summary.totalTokens).toBe(300)
    expect(summary.allTotalTokens).toBe(1000)
    expect(summary.shareOfComparisonWindowPct).toBe(30)
    expect(summary.supportingMentionCount).toBe(1)
  })
})
