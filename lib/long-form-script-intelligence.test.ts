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

  it('stays unscored when the packet contract is incomplete', () => {
    const cases: Array<{ label: string; mutate: (packet: ReturnType<typeof longFormScriptQaFixture>) => void; blocker: string }> = [
      {
        label: 'version',
        mutate: (packet) => { packet.version = 'long-form-script-intelligence-v0' as typeof packet.version },
        blocker: 'Script intelligence packet version is missing or unsupported.',
      },
      {
        label: 'identity',
        mutate: (packet) => { packet.topic = '   ' },
        blocker: 'Script identity, version, topic, and promise are required.',
      },
      {
        label: 'duration',
        mutate: (packet) => { packet.expected_duration_seconds = 179 },
        blocker: 'A valid evaluation time and long-form duration of at least 180 seconds are required.',
      },
      {
        label: 'clock',
        mutate: (packet) => { packet.evaluated_at = 'not-a-time' },
        blocker: 'A valid evaluation time and long-form duration of at least 180 seconds are required.',
      },
      {
        label: 'beats',
        mutate: (packet) => { packet.beats = [] },
        blocker: 'Versioned script beats and topic evidence are required.',
      },
      {
        label: 'spoken text',
        mutate: (packet) => { packet.beats[0].text = '   ' },
        blocker: 'Every script beat needs a stable id, spoken text, and valid start/end timing.',
      },
      {
        label: 'timing',
        mutate: (packet) => { packet.beats.at(-1)!.end_seconds = 181 },
        blocker: 'Every script beat needs a stable id, spoken text, and valid start/end timing.',
      },
    ]

    expect(evaluateLongFormScriptIntelligence(null).blockers).toEqual([
      'Script intelligence packet version is missing or unsupported.',
    ])

    for (const testCase of cases) {
      const packet = longFormScriptQaFixture('ready')
      testCase.mutate(packet)
      const result = evaluateLongFormScriptIntelligence(packet)

      expect(result.status, testCase.label).toBe('unscored')
      expect(result.approval_ready, testCase.label).toBe(false)
      expect(result.overall_score, testCase.label).toBeNull()
      expect(result.blockers, testCase.label).toEqual([testCase.blocker])
    }
  })

  it('excludes future, undated, off-topic, unauthorized, and non-positive performance evidence', () => {
    const cases: Array<{ label: string; mutate: (packet: ReturnType<typeof longFormScriptQaFixture>) => void; reason: string }> = [
      {
        label: 'future',
        mutate: (packet) => { packet.topic_outlier_evidence[0].observed_at = '2026-10-19T00:00:00.000Z' },
        reason: 'Observation is outside the 30-day freshness window.',
      },
      {
        label: 'undated',
        mutate: (packet) => { packet.topic_outlier_evidence[0].published_at = '' },
        reason: 'Freshness timestamps are missing or invalid.',
      },
      {
        label: 'off-topic',
        mutate: (packet) => { packet.topic_outlier_evidence[0].topic = 'unrelated gardening tips' },
        reason: 'Source is not specific enough to the current topic.',
      },
      {
        label: 'unauthorized',
        mutate: (packet) => { packet.topic_outlier_evidence[0].attribution_status = 'unauthorized' },
        reason: 'Source is missing public attribution or is unauthorized.',
      },
      {
        label: 'baseline',
        mutate: (packet) => { packet.topic_outlier_evidence[0].channel_baseline_views = 0 },
        reason: 'Performance inputs are missing or invalid.',
      },
      {
        label: 'non-http',
        mutate: (packet) => { packet.topic_outlier_evidence[0].source_url = 'ftp://files.example.com/topic' },
        reason: 'Source is missing public attribution or is unauthorized.',
      },
    ]

    for (const testCase of cases) {
      const packet = longFormScriptQaFixture('ready')
      testCase.mutate(packet)
      const result = evaluateLongFormScriptIntelligence(packet)

      expect(result.approval_ready, testCase.label).toBe(false)
      expect(result.status, testCase.label).toBe('unscored')
      expect(result.overall_score, testCase.label).toBeNull()
      expect(result.topic_evidence.excluded, testCase.label).toEqual([
        expect.objectContaining({ id: 'topic-1', reason: testCase.reason }),
      ])
      expect(result.topic_evidence.blocker, testCase.label).toBe('Only 2 attributable fresh same-topic sources are available; 3 are required.')
    }

    const httpPacket = longFormScriptQaFixture('ready')
    for (const source of httpPacket.topic_outlier_evidence) {
      source.source_url = source.source_url.replace('https://', 'http://')
    }
    expect(evaluateLongFormScriptIntelligence(httpPacket).status).toBe('passed')
  })

  it('stays unscored when every fresh source is below the 1.5x outlier threshold', () => {
    const packet = longFormScriptQaFixture('ready')
    for (const source of packet.topic_outlier_evidence) {
      source.views = 14_000
      source.channel_baseline_views = 10_000
    }

    const result = evaluateLongFormScriptIntelligence(packet)

    expect(result.status).toBe('unscored')
    expect(result.approval_ready).toBe(false)
    expect(result.overall_score).toBeNull()
    expect(result.topic_evidence.included).toHaveLength(3)
    expect(result.topic_evidence.included.every((source) => source.outlier_ratio < 1.5)).toBe(true)
    expect(result.topic_evidence.blocker).toBe('No included source meets the 1.5x topic outlier threshold.')
  })

  it('does not trust a passed creator-distance status when voice, phrase distance, or copied phrases fail', () => {
    const cases: Array<{ label: string; mutate: (packet: ReturnType<typeof longFormScriptQaFixture>) => void; blocker: string }> = [
      {
        label: 'voice',
        mutate: (packet) => { packet.creator_distance.voice_profile = 'missing' },
        blocker: 'Vambah voice profile is missing.',
      },
      {
        label: 'phrase distance',
        mutate: (packet) => { packet.creator_distance.longest_matching_phrase_words = null },
        blocker: 'Phrase-distance comparison is missing.',
      },
      {
        label: 'copied phrase',
        mutate: (packet) => { packet.creator_distance.copied_phrase_hits = ['synthetic copied phrase'] },
        blocker: 'Creator phrase overlap exceeds the approved originality distance.',
      },
    ]

    for (const testCase of cases) {
      const packet = longFormScriptQaFixture('ready')
      expect(packet.creator_distance.status, testCase.label).toBe('passed')
      testCase.mutate(packet)
      const result = evaluateLongFormScriptIntelligence(packet)

      expect(result.status, testCase.label).toBe('blocked')
      expect(result.approval_ready, testCase.label).toBe(false)
      expect(result.overall_score, testCase.label).not.toBeNull()
      expect(result.blockers, testCase.label).toContain(testCase.blocker)
    }
  })

  it('blocks an unknown framework rule id', () => {
    const packet = longFormScriptQaFixture('ready')
    packet.framework_rule_ids = [...packet.framework_rule_ids, 'rule-not-in-library']

    const result = evaluateLongFormScriptIntelligence(packet)

    expect(result.status).toBe('blocked')
    expect(result.approval_ready).toBe(false)
    expect(result.blockers).toContain('Unknown framework rule ids: rule-not-in-library.')
  })

  it('blocks an early conclusion, a CTA outside the final 10 percent, late proof, and a long interrupt gap', () => {
    const earlyConclusion = longFormScriptQaFixture('ready')
    const conclusion = earlyConclusion.beats.find((beat) => beat.role === 'conclusion')!
    conclusion.start_seconds = 140
    conclusion.end_seconds = 149
    const earlyResult = evaluateLongFormScriptIntelligence(earlyConclusion)
    expect(earlyResult.approval_ready).toBe(false)
    expect(earlyResult.dimensions.find((dimension) => dimension.key === 'spoken_conclusion')).toMatchObject({
      status: 'blocked',
      score: 55,
    })

    const shortCta = longFormScriptQaFixture('ready')
    const cta = shortCta.beats.find((beat) => beat.role === 'cta')!
    cta.start_seconds = 156
    cta.end_seconds = 161
    const ctaResult = evaluateLongFormScriptIntelligence(shortCta)
    expect(ctaResult.dimensions.find((dimension) => dimension.key === 'spoken_conclusion')?.status).toBe('passed')
    expect(ctaResult.dimensions.find((dimension) => dimension.key === 'delivered_cta')).toMatchObject({
      status: 'blocked',
      score: 50,
    })

    const lateProof = longFormScriptQaFixture('ready')
    const proof = lateProof.beats.find((beat) => beat.role === 'proof')!
    proof.start_seconds = 55
    proof.end_seconds = 70
    expect(evaluateLongFormScriptIntelligence(lateProof).dimensions.find((dimension) => dimension.key === 'proof_placement')).toMatchObject({
      status: 'blocked',
      score: 55,
    })

    const sparse = longFormScriptQaFixture('ready')
    for (const beat of sparse.beats) beat.pattern_interrupt = null
    const sparseResult = evaluateLongFormScriptIntelligence(sparse)
    expect(sparseResult.approval_ready).toBe(false)
    expect(sparseResult.dimensions.find((dimension) => dimension.key === 'pattern_interrupts')).toMatchObject({
      status: 'blocked',
      score: 35,
    })
  })

  it('does not promote unapproved research or an unrecognized distance receipt', () => {
    const fixture = longFormSelectedDraftQaFixture('ready')
    fixture.researchPackets[0].pattern_status = 'needs_brand_translation'
    fixture.researchPackets[1].source_url = 'ftp://files.example.com/topic'
    const scorecard = fixture.draft.script_scorecard as Record<string, unknown>
    const persisted = scorecard.long_form_script_intelligence as Record<string, unknown>
    persisted.creator_distance = {
      status: 'approved',
      voice_profile: 'other',
      longest_matching_phrase_words: '4',
      compared_source_ids: ['  '],
    }

    const input = buildLongFormScriptReviewInputFromDraft(fixture)
    const result = evaluateLongFormScriptIntelligence(input)

    expect(input.topic_outlier_evidence.map((source) => source.attribution_status)).toEqual(['missing', 'missing', 'attributable'])
    expect(input.creator_distance).toMatchObject({
      status: 'unscored',
      voice_profile: 'missing',
      longest_matching_phrase_words: null,
      compared_source_ids: [],
    })
    expect(result.status).toBe('unscored')
    expect(result.approval_ready).toBe(false)
    expect(result.overall_score).toBeNull()
  })

  it('infers a positive baseline, honors the caller clock, and drops invalid persisted beats', () => {
    const fixture = longFormSelectedDraftQaFixture('ready')
    fixture.researchPackets[0].metrics = {
      views: 24_000,
      channel_relative_performance: 2.4,
      published_at: '2026-10-10T12:00:00.000Z',
      retrieved_at: '2026-10-17T12:00:00.000Z',
    }
    const scorecard = fixture.draft.script_scorecard as Record<string, unknown>
    const persisted = scorecard.long_form_script_intelligence as Record<string, unknown>
    persisted.framework_rule_ids = ['   ']
    persisted.beats = [{ id: 'bad', role: 'intro', start_seconds: 0, end_seconds: 10, text: 'not a script role' }]

    const input = buildLongFormScriptReviewInputFromDraft({
      ...fixture,
      evaluatedAt: '2026-10-17T18:00:00.000Z',
    })

    expect(input.evaluated_at).toBe('2026-10-17T18:00:00.000Z')
    expect(input.topic_outlier_evidence[0]).toMatchObject({
      attribution_status: 'attributable',
      channel_baseline_views: 10_000,
      views: 24_000,
    })
    expect(input.framework_rule_ids).toEqual(expect.arrayContaining([
      'rule-hook-promise-contract',
      'rule-proof-near-claim',
      'rule-visual-cue-purpose',
      'rule-value-before-cta',
      'rule-live-topic-demand',
    ]))
    expect(input.beats.some((beat) => beat.id === 'bad')).toBe(false)
    expect(input.beats.every((beat) => beat.id.startsWith('derived-'))).toBe(true)
    expect(evaluateLongFormScriptIntelligence(input).approval_ready).toBe(false)
  })
})
