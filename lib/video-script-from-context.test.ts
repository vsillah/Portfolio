import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchVideoScriptContext,
  type VideoScriptContext,
} from '@/lib/gamma-report-builder'
import {
  buildVideoScriptFromContext,
  buildVideoScriptFromVideoContext,
} from './video-script-from-context'

vi.mock('@/lib/gamma-report-builder', () => ({
  fetchVideoScriptContext: vi.fn(),
}))

const mockedFetchVideoScriptContext = vi.mocked(fetchVideoScriptContext)

function makeContext(overrides: Partial<VideoScriptContext> = {}): VideoScriptContext {
  return {
    contactName: 'Jordan',
    company: 'Acme Co',
    industry: 'Retail',
    diagnosticSummary: 'Manual handoffs are slowing down operations.',
    valueStatementsSummary: 'You can reclaim 220 hours per quarter through automation.',
    totalAnnualValue: 84000,
    topPainPoints: ['Lead response lag', 'Manual proposal assembly', 'Follow-up inconsistency'],
    ...overrides,
  }
}

describe('buildVideoScriptFromVideoContext', () => {
  it('renders a personalized script with top two pain points and closing CTA', () => {
    const script = buildVideoScriptFromVideoContext(makeContext())

    expect(script).toContain('Hi Jordan,')
    expect(script).toContain('I put together a short overview for Acme Co.')
    expect(script).toContain('Based on our conversation: Manual handoffs are slowing down operations.')
    expect(script).toContain('You can reclaim 220 hours per quarter through automation.')
    expect(script).toContain(
      'Key areas we looked at: Lead response lag, Manual proposal assembly.'
    )
    expect(script).not.toContain('Follow-up inconsistency')
    expect(script).toContain("Check the full report for the details. Let's get it.")
  })

  it('uses non-personalized company intro when contact name is not available', () => {
    const script = buildVideoScriptFromVideoContext(
      makeContext({
        contactName: null,
      })
    )

    expect(script).toContain('This is a quick overview for Acme Co.')
    expect(script).not.toContain('Hi Jordan,')
  })

  it('truncates long diagnostic summary with ellipsis', () => {
    const longSummary = 'a'.repeat(320)
    const script = buildVideoScriptFromVideoContext(
      makeContext({
        diagnosticSummary: longSummary,
      })
    )

    expect(script).toContain(`Based on our conversation: ${'a'.repeat(277)}...`)
    expect(script).not.toContain(`Based on our conversation: ${longSummary}`)
  })

  it('falls back to generic script when context is empty', () => {
    const script = buildVideoScriptFromVideoContext(
      makeContext({
        contactName: null,
        company: null,
        diagnosticSummary: null,
        valueStatementsSummary: null,
        topPainPoints: [],
      })
    )

    expect(script).toBe(
      "Thanks for your interest. I've prepared a report for you — check the link for the full picture. Let's get it."
    )
  })
})

describe('buildVideoScriptFromContext', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('fetches report context and renders script from that context', async () => {
    mockedFetchVideoScriptContext.mockResolvedValue({
      contactName: 'Amadu',
      company: 'ATAS',
      industry: 'Consulting',
      diagnosticSummary: null,
      valueStatementsSummary: null,
      totalAnnualValue: null,
      topPainPoints: ['Pipeline gaps'],
    })

    const script = await buildVideoScriptFromContext({
      reportType: 'audit_summary',
    })

    expect(mockedFetchVideoScriptContext).toHaveBeenCalledWith({
      reportType: 'audit_summary',
    })
    expect(script).toContain('Hi Amadu,')
    expect(script).toContain('I put together a short overview for ATAS.')
    expect(script).toContain('Key areas we looked at: Pipeline gaps.')
  })
})
