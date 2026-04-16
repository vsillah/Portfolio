import { describe, it, expect } from 'vitest'

import {
  buildEvidenceIndex,
  buildEvidenceLedgerSlide,
  buildSourceFidelityPreamble,
  citationTag,
  firstOfKind,
  itemsForAuditCategory,
  itemsForPainPoint,
  tagsList,
  type EvidenceIndexInputs,
} from './gamma-evidence-index'

const PAIN_TRANSCRIPT =
  'We spend at least 12 hours a week on manual donor follow-up. Our volunteers keep losing track of who they reached. We are missing renewals because the process is slow and broken.'

function fullInputs(): EvidenceIndexInputs {
  return {
    audit: {
      diagnostic_summary: 'High urgency mid-market nonprofit.',
      key_insights: ['Manual follow-up costs 10+ hrs/wk'],
      recommended_actions: ['Automate donor follow-up'],
      business_challenges: { primary_challenges: ['manual_processes', 'slow_follow_up'] },
      tech_stack: { crm: 'hubspot', email: 'gmail' },
      automation_needs: { priority_areas: ['lead_follow_up'] },
      ai_readiness: { data_quality: 'some_systems' },
      budget_timeline: { budget_range: 'medium', timeline: '4_8_weeks' },
      decision_making: { decision_maker: true },
      enriched_tech_stack: { byTag: { analytics: ['Google Analytics 4'] } },
      urgency_score: 8,
      opportunity_score: 9,
    },
    contactWebsiteTechStack: {
      technologies: ['WordPress', 'Cloudflare'],
      byTag: { cms: ['WordPress'], cdn: ['Cloudflare'] },
    },
    valueStatements: [
      {
        painPoint: 'Donor Follow-up',
        formulaReadable: '12 hrs/wk * $45/hr * 52 weeks = $28,080',
        evidenceSummary: 'Discovery call: 12 hrs/wk on manual follow-up',
        annualValue: 28080,
      },
      {
        painPoint: 'Volunteer Onboarding',
        formulaReadable: '6 hrs * $35 * 52 = $10,920',
        evidenceSummary: 'Average per onboarding cycle',
        annualValue: 10920,
      },
    ],
    benchmarks: [
      {
        industry: 'nonprofit',
        benchmark_type: 'donor_retention_rate',
        value: 0.45,
        source: 'Fundraising Effectiveness Project',
      },
    ],
    meetings: [
      {
        id: 'm1',
        meeting_type: 'discovery',
        meeting_date: '2026-04-13T15:00:00.000Z',
        transcript: PAIN_TRANSCRIPT,
        structured_notes: { summary: 'Manual workflows everywhere.', highlights: ['budget approved'] },
      },
    ],
    painPointEvidence: [
      {
        id: 'ppe-1',
        excerpt: 'Manual data entry consumes 8 hours per staff member each week.',
        sourceType: 'industry_report',
        categoryId: 'cat-manual',
      },
    ],
  }
}

describe('buildEvidenceIndex', () => {
  it('returns empty array when nothing is provided', () => {
    expect(buildEvidenceIndex({ audit: null })).toEqual([])
  })

  it('numbers items deterministically by kind order', () => {
    const items = buildEvidenceIndex(fullInputs())

    expect(items.length).toBeGreaterThan(0)
    expect(items[0].id).toBe('E1')
    expect(items[items.length - 1].id).toBe(`E${items.length}`)

    const kindOrder = items.map((i) => i.kind)
    const firstAudit = kindOrder.indexOf('audit_response')
    const firstMeeting = kindOrder.indexOf('meeting_quote')
    const firstTech = kindOrder.indexOf('tech_stack')
    const firstFormula = kindOrder.indexOf('value_formula')
    const firstBenchmark = kindOrder.indexOf('benchmark')

    expect(firstMeeting).toBeLessThan(firstAudit)
    expect(firstAudit).toBeLessThan(firstTech)
    expect(firstTech).toBeLessThan(firstFormula)
    expect(firstFormula).toBeLessThan(firstBenchmark)
  })

  it('extracts a meeting quote from transcript', () => {
    const items = buildEvidenceIndex(fullInputs())
    const meetingQuotes = items.filter((i) => i.kind === 'meeting_quote')
    expect(meetingQuotes.length).toBeGreaterThan(0)
    expect(meetingQuotes[0].sourceLabel).toMatch(/discovery/i)
    expect(meetingQuotes[0].dateLabel).toBe('2026-04-13')
    expect(meetingQuotes[0].verbatim.length).toBeGreaterThan(20)
  })

  it('dedupes meeting quotes with identical opening text', () => {
    const inputs = fullInputs()
    inputs.pickedMeetingVerbatims = [
      {
        id: 'm1',
        verbatim: PAIN_TRANSCRIPT.split('. ')[0] + '.',
        sourceLabel: 'Discovery call',
        dateLabel: '2026-04-13',
      },
    ]
    const items = buildEvidenceIndex(inputs)
    const quotes = items.filter((i) => i.kind === 'meeting_quote')
    const lowered = quotes.map((q) => q.verbatim.toLowerCase().slice(0, 40))
    expect(new Set(lowered).size).toBe(lowered.length)
  })

  it('emits an audit_response with category metadata', () => {
    const items = buildEvidenceIndex(fullInputs())
    const challenge = items.find(
      (i) => i.kind === 'audit_response' && i.meta?.category === 'business_challenges'
    )
    expect(challenge).toBeDefined()
    expect(challenge?.verbatim).toMatch(/manual_processes/i)
  })

  it('emits one audit_response entry summarizing urgency and opportunity scores', () => {
    const items = buildEvidenceIndex(fullInputs())
    const scoresItem = items.find(
      (i) => i.kind === 'audit_response' && i.meta?.category === 'scores'
    )
    expect(scoresItem?.verbatim).toContain('Urgency 8/10')
    expect(scoresItem?.verbatim).toContain('Opportunity 9/10')
  })

  it('emits tech_stack items deduped across site and audit sources', () => {
    const items = buildEvidenceIndex(fullInputs())
    const tech = items.filter((i) => i.kind === 'tech_stack')
    const verbatims = tech.map((t) => t.verbatim.toLowerCase())
    expect(verbatims.some((v) => v.includes('wordpress'))).toBe(true)
    expect(new Set(verbatims).size).toBe(verbatims.length)
  })

  it('emits a value_formula entry per value statement', () => {
    const items = buildEvidenceIndex(fullInputs())
    const formulas = items.filter((i) => i.kind === 'value_formula')
    expect(formulas).toHaveLength(2)
    expect(formulas[0].sourceLabel).toMatch(/Donor Follow-up/)
  })

  it('emits a benchmark with source label', () => {
    const items = buildEvidenceIndex(fullInputs())
    const bench = items.find((i) => i.kind === 'benchmark')
    expect(bench?.sourceLabel).toContain('Fundraising Effectiveness Project')
    expect(bench?.verbatim).toContain('Donor Retention Rate')
  })

  it('truncates long verbatims to a reasonable length', () => {
    const inputs = fullInputs()
    inputs.meetings = [
      {
        id: 'm-long',
        meeting_type: 'discovery',
        meeting_date: '2026-04-14T00:00:00.000Z',
        transcript:
          'We spend so much time on manual donor follow-up that I cannot even keep track of how many hours we lose each week to this process. ' +
          'Every single staff member is overwhelmed because of the bottleneck and the slow lead follow-up that has been costing us thousands of dollars. '.repeat(
            6
          ),
        structured_notes: null,
      },
    ]
    const items = buildEvidenceIndex(inputs)
    const meetingQuotes = items.filter((i) => i.kind === 'meeting_quote')
    for (const q of meetingQuotes) {
      expect(q.verbatim.length).toBeLessThanOrEqual(320)
    }
  })
})

describe('buildEvidenceLedgerSlide', () => {
  it('renders a clear empty-state slide when no items', () => {
    const md = buildEvidenceLedgerSlide([])
    expect(md).toMatch(/EVIDENCE LEDGER/)
    expect(md).toMatch(/No structured source data/i)
  })

  it('groups items by kind with headings and includes verbatims', () => {
    const items = buildEvidenceIndex(fullInputs())
    const md = buildEvidenceLedgerSlide(items)
    expect(md).toMatch(/EVIDENCE LEDGER/)
    expect(md).toMatch(/### Meeting verbatims/)
    expect(md).toMatch(/### Diagnostic audit responses/)
    expect(md).toMatch(/### Detected technology/)
    expect(md).toMatch(/### Value calculations/)
    expect(md).toMatch(/### Industry benchmarks/)
    for (const item of items) {
      expect(md).toContain(`**${item.id}**`)
    }
  })
})

describe('buildSourceFidelityPreamble', () => {
  it('lists every evidence item by id', () => {
    const items = buildEvidenceIndex(fullInputs())
    const preamble = buildSourceFidelityPreamble(items)
    for (const item of items) {
      expect(preamble).toContain(item.id)
    }
    expect(preamble).toMatch(/SOURCE FIDELITY RULES/)
    expect(preamble).toMatch(/EVIDENCE INDEX/)
  })

  it('warns about no evidence when index is empty', () => {
    const preamble = buildSourceFidelityPreamble([])
    expect(preamble).toMatch(/No structured evidence is attached/i)
  })
})

describe('utility helpers', () => {
  it('citationTag wraps id in brackets', () => {
    expect(citationTag('E7')).toBe('[E7]')
  })

  it('firstOfKind returns the first matching item or undefined', () => {
    const items = buildEvidenceIndex(fullInputs())
    expect(firstOfKind(items, 'meeting_quote')?.kind).toBe('meeting_quote')
    expect(firstOfKind(items, 'pain_point_evidence')?.kind).toBe('pain_point_evidence')
  })

  it('itemsForAuditCategory filters audit responses by category meta', () => {
    const items = buildEvidenceIndex(fullInputs())
    const challenges = itemsForAuditCategory(items, 'business_challenges')
    expect(challenges.length).toBeGreaterThan(0)
    for (const c of challenges) {
      expect(c.meta?.category).toBe('business_challenges')
    }
  })

  it('itemsForPainPoint matches by source label substring', () => {
    const items = buildEvidenceIndex(fullInputs())
    const matches = itemsForPainPoint(items, 'donor follow-up')
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0].kind).toBe('value_formula')
  })

  it('tagsList renders all ids without separators', () => {
    const items = buildEvidenceIndex(fullInputs()).slice(0, 3)
    const out = tagsList(items)
    expect(out.startsWith('[E1]')).toBe(true)
    expect(out).not.toMatch(/\s/)
  })
})
