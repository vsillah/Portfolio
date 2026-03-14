import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VideoScriptContext } from './gamma-report-builder'
import { fetchVideoScriptContext } from './gamma-report-builder'
import {
  buildVideoScriptFromContext,
  buildVideoScriptFromVideoContext,
} from './video-script-from-context'

vi.mock('./gamma-report-builder', () => ({
  fetchVideoScriptContext: vi.fn(),
}))

const mockedFetchVideoScriptContext = vi.mocked(fetchVideoScriptContext)

describe('buildVideoScriptFromVideoContext', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a personalized script and limits pain points to top two', () => {
    const longSummary = 'A'.repeat(281)
    const context: VideoScriptContext = {
      contactName: 'Vambah',
      company: 'AmaduTown Advisory Solutions',
      industry: 'Advisory',
      diagnosticSummary: longSummary,
      valueStatementsSummary: 'You can recover 120+ hours each quarter with automation.',
      totalAnnualValue: 125000,
      topPainPoints: ['Manual reporting', 'Lead follow-up delays', 'Context switching'],
    }

    const script = buildVideoScriptFromVideoContext(context)

    expect(script).toContain('Hi Vambah,')
    expect(script).toContain('I put together a short overview for AmaduTown Advisory Solutions.')
    expect(script).toContain(`Based on our conversation: ${'A'.repeat(277)}...`)
    expect(script).toContain(
      'You can recover 120+ hours each quarter with automation.'
    )
    expect(script).toContain(
      'Key areas we looked at: Manual reporting, Lead follow-up delays.'
    )
    expect(script).not.toContain('Context switching')
    expect(script).toContain("Check the full report for the details. Let's get it.")
  })

  it('uses generic company intro when contact name is unavailable', () => {
    const context: VideoScriptContext = {
      contactName: null,
      company: 'AmaduTown',
      industry: null,
      diagnosticSummary: null,
      valueStatementsSummary: null,
      totalAnnualValue: null,
      topPainPoints: [],
    }

    const script = buildVideoScriptFromVideoContext(context)

    expect(script).toContain('This is a quick overview for AmaduTown.')
    expect(script).not.toContain('Hi ')
  })

  it('returns fallback CTA when no context fields are available', () => {
    const context: VideoScriptContext = {
      contactName: null,
      company: null,
      industry: null,
      diagnosticSummary: null,
      valueStatementsSummary: null,
      totalAnnualValue: null,
      topPainPoints: [],
    }

    const script = buildVideoScriptFromVideoContext(context)

    expect(script).toContain("Thanks for your interest. I've prepared a report for you")
    expect(script).toContain("Let's get it.")
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
