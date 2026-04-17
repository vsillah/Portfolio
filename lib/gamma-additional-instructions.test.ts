import { describe, it, expect, vi } from 'vitest'

vi.mock('./supabase', () => ({
  supabaseAdmin: null,
  default: null,
}))

import { composeAdditionalInstructions } from './gamma-report-builder'
import { GAMMA_MAX_ADDITIONAL_INSTRUCTIONS } from './gamma-client'

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    contact: null,
    audit: null,
    valueReport: null,
    services: [],
    painPoints: [],
    benchmarks: [],
    meetings: [],
    painPointEvidence: [],
    ...overrides,
  } as Parameters<typeof composeAdditionalInstructions>[0]
}

describe('composeAdditionalInstructions', () => {
  it('returns the full composition when it fits under the Gamma 5000-char cap', () => {
    const result = composeAdditionalInstructions(makeContext(), undefined, undefined, null)
    expect(result).toBeTruthy()
    expect((result as string).length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(result).toContain('[SOURCE FIDELITY RULES — read first]')
  })

  it('truncates the Evidence Index but preserves rules + custom instructions when over the cap', () => {
    const pickedVerbatims = Array.from({ length: 40 }, (_, i) => ({
      id: `m-${i}`,
      sourceLabel: 'Discovery call',
      dateLabel: '2026-01-01',
      verbatim:
        `Meeting ${i} verbatim: ` + 'pain point detail, staff context, and specific numbers. '.repeat(20),
    }))

    const custom = 'CUSTOM_CALLER_INSTRUCTION_MARKER'
    const result = composeAdditionalInstructions(
      makeContext(),
      { meetingVerbatims: pickedVerbatims, customInstructions: custom } as Parameters<typeof composeAdditionalInstructions>[1],
      undefined,
      null
    )

    expect(result).toBeTruthy()
    const out = result as string
    expect(out.length).toBeLessThanOrEqual(GAMMA_MAX_ADDITIONAL_INSTRUCTIONS)
    expect(out).toContain('[SOURCE FIDELITY RULES — read first]')
    expect(out).toContain(custom)
    expect(out).toContain('evidence list truncated')
  })
})
