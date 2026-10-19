import { describe, expect, it } from 'vitest'
import {
  LONG_FORM_FRAMEWORK_LIBRARY,
  LONG_FORM_FRAMEWORK_LIBRARY_VERSION,
  buildLongFormScriptReviewInputFromDraft,
  evaluateLongFormScriptIntelligence,
  longFormSelectedDraftQaFixture,
  longFormScriptQaFixture,
} from './long-form-script-intelligence'

describe('long-form script intelligence', () => {
  it('keeps raw public source metadata separate from derived framework receipts', () => {
    expect(LONG_FORM_FRAMEWORK_LIBRARY.version).toBe(LONG_FORM_FRAMEWORK_LIBRARY_VERSION)
    expect(LONG_FORM_FRAMEWORK_LIBRARY.playlist.url).toContain('PLbfxkgOJ1hVfHsYetjs9aXvV7UysKoujZ')
    expect(LONG_FORM_FRAMEWORK_LIBRARY.sources.map((source) => source.creator)).toEqual(expect.arrayContaining([
      'Alex Hormozi',
      'Nick Saraev',
      'Vanessa Lau',
      'Oscar Owen',
      'Katie Steckly',
      'Liam Ottley',
    ]))
    expect(LONG_FORM_FRAMEWORK_LIBRARY.rules.every((rule) => (
      rule.source_ids.length > 0
      && rule.derivation_receipt.length > 20
      && rule.imitation_boundary.length > 20
    ))).toBe(true)
    expect(LONG_FORM_FRAMEWORK_LIBRARY.sources.every((source) => (
      source.url.startsWith('http')
      && Number.isFinite(Date.parse(source.observed_at))
    ))).toBe(true)
  })

  it('passes a source-attributable packet and exposes every required script decision', () => {
    const result = evaluateLongFormScriptIntelligence(longFormScriptQaFixture('ready'))

    expect(result.status).toBe('passed')
    expect(result.approval_ready).toBe(true)
    expect(result.overall_score).toBeGreaterThanOrEqual(90)
    expect(result.dimensions.map((dimension) => dimension.key)).toEqual([
      'first_30_seconds',
      'hook_promise_alignment',
      'open_loops',
      'rehooks',
      'proof_placement',
      'pacing',
      'pattern_interrupts',
      'broll_cues',
      'payoff',
      'spoken_conclusion',
      'delivered_cta',
    ])
    expect(result.dimensions.every((dimension) => (
      dimension.status === 'passed'
      && dimension.input_ids.length > 0
      && dimension.formula.length > 0
    ))).toBe(true)
    expect(result.input_fingerprint).toMatch(/^fnv1a:/)
  })

  it('adapts the selected draft and its bound research receipts into the same deterministic review', () => {
    const fixture = longFormSelectedDraftQaFixture('ready')
    const input = buildLongFormScriptReviewInputFromDraft(fixture)
    const result = evaluateLongFormScriptIntelligence(input)

    expect(input.script_id).toBe(fixture.draft.id)
    expect(input.topic_outlier_evidence.map((source) => source.id)).toEqual(fixture.draft.research_packet_ids)
    expect(result.status).toBe('passed')
    expect(result.approval_ready).toBe(true)
  })

  it('keeps selected drafts Unscored when persisted creator-distance or research receipts are missing', () => {
    const fixture = longFormSelectedDraftQaFixture('ready')
    const scorecard = fixture.draft.script_scorecard as Record<string, unknown>
    const persisted = scorecard.long_form_script_intelligence as Record<string, unknown>
    persisted.creator_distance = null
    fixture.researchPackets = []
    const result = evaluateLongFormScriptIntelligence(buildLongFormScriptReviewInputFromDraft(fixture))

    expect(result.status).toBe('unscored')
    expect(result.approval_ready).toBe(false)
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('attributable fresh same-topic sources'),
      'Creator-distance receipt has not passed.',
    ]))
  })

  it('fails closed when current topic evidence is stale or missing attribution', () => {
    const stale = evaluateLongFormScriptIntelligence(longFormScriptQaFixture('stale'))
    const missing = evaluateLongFormScriptIntelligence(longFormScriptQaFixture('missing'))

    expect(stale.status).toBe('unscored')
    expect(stale.approval_ready).toBe(false)
    expect(stale.overall_score).toBeNull()
    expect(stale.topic_evidence.excluded.every((source) => source.reason.includes('freshness'))).toBe(true)
    expect(stale.topic_evidence.recovery).toContain('Content Intelligence')

    expect(missing.status).toBe('unscored')
    expect(missing.topic_evidence.included).toHaveLength(2)
    expect(missing.topic_evidence.excluded[0]?.reason).toContain('attribution')
  })

  it('blocks approval when creator-distance evidence detects imitation risk', () => {
    const result = evaluateLongFormScriptIntelligence(longFormScriptQaFixture('originality_blocked'))

    expect(result.status).toBe('blocked')
    expect(result.approval_ready).toBe(false)
    expect(result.blockers).toContain('Creator-distance receipt has not passed.')
    expect(result.originality.longest_matching_phrase_words).toBeGreaterThan(result.originality.maximum_allowed_phrase_words)
    expect(result.originality.copied_phrase_hits).not.toHaveLength(0)
  })

  it('enforces a spoken conclusion followed by a delivered closing CTA', () => {
    const packet = longFormScriptQaFixture('ready')
    packet.beats = packet.beats.filter((beat) => beat.role !== 'conclusion')
    const missingConclusion = evaluateLongFormScriptIntelligence(packet)

    expect(missingConclusion.approval_ready).toBe(false)
    expect(missingConclusion.dimensions.find((dimension) => dimension.key === 'spoken_conclusion')).toMatchObject({
      status: 'blocked',
      score: 0,
    })

    const reordered = longFormScriptQaFixture('ready')
    const cta = reordered.beats.find((beat) => beat.role === 'cta')!
    cta.start_seconds = 145
    cta.end_seconds = 150
    const result = evaluateLongFormScriptIntelligence(reordered)
    expect(result.dimensions.find((dimension) => dimension.key === 'delivered_cta')).toMatchObject({
      status: 'blocked',
      score: 50,
    })
    expect(result.blockers.some((blocker) => blocker.startsWith('Delivered CTA:'))).toBe(true)
  })

  it('uses deterministic inputs: the same packet returns the same fingerprint and score', () => {
    const packet = longFormScriptQaFixture('ready')
    const first = evaluateLongFormScriptIntelligence(packet)
    const second = evaluateLongFormScriptIntelligence(structuredClone(packet))

    expect(second.input_fingerprint).toBe(first.input_fingerprint)
    expect(second.overall_score).toBe(first.overall_score)
    expect(second.dimensions).toEqual(first.dimensions)
  })
})
