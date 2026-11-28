import { describe, expect, it } from 'vitest'
import { buildRecoveryPackets, RECOVERY_FAMILIES, type ApprovedBinding, type RecoveryInput } from './eval-recovery-packets'

const sha = 'a'.repeat(64)
const ids = RECOVERY_FAMILIES
const channels = Object.keys(ids) as Array<keyof typeof ids>
const snapshot = {
  chatbot: { count: 6, latestAt: '2026-02-27T17:27:15.469Z' },
  'llm-judge': { count: 7, latestAt: '2026-02-27T17:27:25.112Z' },
  agent: { count: 5, latestAt: '2026-08-30T01:34:47.882Z' },
  'video-script': { count: 0, latestAt: null },
}
const bindings: ApprovedBinding[] = channels.map(channel => {
  const familyId = ids[channel]
  const version = { kind: channel === 'agent' ? 'rubric' as const : channel === 'video-script' ? 'template' as const : 'prompt' as const, value: 'v1', source: 'approved-current-version-register' }
  return {
    channel, familyId, version,
    source: { id: channel === 'video-script' ? 'template-1' : `source-${channel}`, revision: 'r1', approvalId: 'approval-1', evidenceSha256: sha, channel, familyId, version: 'v1', approved: true },
    candidate: channel === 'video-script' ? { id: 'candidate-1', scriptId: 'script-1', templateId: 'template-1', evidenceId: 'approval-1', approved: true, channel, version: 'v1' } : undefined,
    observed: { ...snapshot[channel], provenance: 'approved redacted operator summary',
      ...(channel === 'chatbot' ? { humanRatings: { good: 0, bad: 6 } } : {}),
      ...(channel === 'llm-judge' ? { judgeRatings: { good: 2, bad: 5, aligned: 5, misaligned: 2 } } : {}),
      ...(channel === 'agent' ? { agentRubric: { key: 'chief-of-staff-synthesis-quality', threshold: 82, average: 76.8, passed: 2, failed: 3 } } : {}),
    },
    attempt: { maxAttempts: 2, maxRetries: 1, expiresAt: '2026-11-10T00:00:00Z' },
  }
})
const input: RecoveryInput = {
  manifest: { families: channels.map(channel => ({ id: ids[channel], owner: channel === 'video-script' ? 'Video content owner' : 'Model Ops', mode: 'gated', threshold: { kind: channel === 'agent' ? 'per-rubric-score' : channel === 'video-script' ? 'zero-blockers' : 'reviewed-per-record-rating', source: 'canonical source' }, freshness: { maxAgeDays: 31 }, evidence: { snapshotKey: channel }, remediation: { owner: channel === 'video-script' ? 'Video content owner' : 'Model Ops', route: 'Integration Captain review' } })) },
  report: { commit: 'c2d76ac59add75434fa98b6f91c32a5d381b01ba', generatedAt: '2026-11-02T10:49:50Z', manifestSha256: sha, snapshotSha256: sha, results: channels.map(channel => ({ id: ids[channel], status: channel === 'video-script' ? 'absent' : 'stale' })), errors: channels.map(channel => `${ids[channel]}: ${channel === 'video-script' ? 'absent' : 'stale'} evidence`) },
  snapshot, manifestSha256: sha, snapshotSha256: sha, baseCommit: 'c2d76ac59add75434fa98b6f91c32a5d381b01ba', now: '2026-11-02T15:00:00Z', bindings,
}
const copy = () => structuredClone(input)

describe('hosted eval recovery packets', () => {
  it('assembles four review-ready packets with exact semantics and no execution state', () => {
    const packets = buildRecoveryPackets(copy())
    expect(packets).toHaveLength(4)
    expect(packets.every(p => p.state === 'review-ready' && p.sideEffects.provider === 'disabled' && p.sideEffects.production === 'disabled')).toBe(true)
    expect(packets.find(p => p.channel === 'agent')).toMatchObject({ threshold: { requiredValue: 82 }, observed: { agentRubric: { average: 76.8, passed: 2, failed: 3 } } })
    expect(packets.find(p => p.channel === 'chatbot')?.observed.humanRatings).toEqual({ good: 0, bad: 6 })
    expect(packets.find(p => p.channel === 'llm-judge')?.observed.judgeRatings).toEqual({ good: 2, bad: 5, aligned: 5, misaligned: 2 })
    expect(packets.find(p => p.channel === 'video-script')).toMatchObject({ historicalFreshness: 'absent', observed: { count: 0, latestAt: null } })
    expect(packets.every(p => p.manifestSha256 === sha)).toBe(true)
  })
  it('blocks manifest drift and older reports without a manifest digest', () => {
    const drift = copy(); drift.manifestSha256 = 'b'.repeat(64)
    expect(buildRecoveryPackets(drift).every(p => p.state === 'blocked' && p.blockers.includes('Canonical manifest digest missing or mismatched.'))).toBe(true)
    const legacy = copy(); delete (legacy.report as Partial<typeof legacy.report>).manifestSha256
    expect(buildRecoveryPackets(legacy).every(p => p.state === 'blocked' && p.blockers.includes('Canonical manifest digest missing or mismatched.'))).toBe(true)
    const malformed = copy(); malformed.report.manifestSha256 = 'not-a-sha256'
    expect(buildRecoveryPackets(malformed).every(p => p.state === 'blocked')).toBe(true)
  })
  it('replays the same packet idempotently and blocks conflicting or duplicate identities', () => {
    const first = buildRecoveryPackets(copy())
    const replay = copy(); replay.previous = first.map(p => ({ key: p.key, digest: p.digest }))
    expect(buildRecoveryPackets(replay).every(p => p.state === 'idempotent-replay')).toBe(true)
    replay.previous[0].digest = 'b'.repeat(64)
    expect(buildRecoveryPackets(replay)[0].state).toBe('blocked')
    const duplicate = copy(); duplicate.bindings.push(structuredClone(duplicate.bindings[0]))
    expect(buildRecoveryPackets(duplicate).at(-1)?.blockers).toContain('Duplicate packet identity in this review.')
  })
  it.each([
    ['family mismatch', (value: RecoveryInput) => { value.bindings[0].familyId = ids.agent }],
    ['version mismatch', (value: RecoveryInput) => { value.bindings[0].source.version = 'v2' }],
    ['channel mismatch', (value: RecoveryInput) => { value.bindings[0].source.channel = 'agent' }],
    ['evidence mismatch', (value: RecoveryInput) => { value.snapshot.chatbot.count = 5 }],
    ['stale report', (value: RecoveryInput) => { value.report.generatedAt = '2026-09-01T00:00:00Z' }],
    ['digest mismatch', (value: RecoveryInput) => { value.report.snapshotSha256 = 'b'.repeat(64) }],
    ['missing candidate', (value: RecoveryInput) => { value.bindings.find(b => b.channel === 'video-script')!.candidate = undefined }],
    ['unapproved source', (value: RecoveryInput) => { value.bindings[0].source.approved = false }],
    ['expired attempt', (value: RecoveryInput) => { value.bindings[0].attempt.expiresAt = '2026-11-01T00:00:00Z' }],
    ['threshold drift', (value: RecoveryInput) => { value.bindings.find(b => b.channel === 'agent')!.observed.agentRubric!.threshold = 80 }],
    ['rating mismatch', (value: RecoveryInput) => { value.bindings.find(b => b.channel === 'llm-judge')!.observed.judgeRatings!.aligned = 4 }],
  ])('blocks %s', (_name, mutate) => {
    const value = copy(); mutate(value)
    expect(buildRecoveryPackets(value).some(p => p.state === 'blocked')).toBe(true)
  })

  it('rejects an invalid review timestamp before assembling packets', () => {
    for (const now of ['not-a-time', '']) {
      expect(() => buildRecoveryPackets({ ...copy(), now })).toThrow('Invalid review timestamp')
    }
  })

  it('blocks a refresh at the exact evidence age and accepts one millisecond older', () => {
    const nowMs = Date.parse(input.now)
    const exact = new Date(nowMs - 31 * 86400000).toISOString()
    const older = new Date(nowMs - 31 * 86400000 - 1).toISOString()
    const current = copy()
    current.snapshot.chatbot.latestAt = exact
    current.bindings.find(binding => binding.channel === 'chatbot')!.observed.latestAt = exact
    current.report.results.find(result => result.id === ids.chatbot)!.status = 'current'
    const currentPacket = buildRecoveryPackets(current).find(packet => packet.channel === 'chatbot')!
    expect(currentPacket.historicalFreshness).toBe('current')
    expect(currentPacket.state).toBe('blocked')
    expect(currentPacket.blockers).toEqual(['Historical evidence is current; refresh packet is not needed.'])
    expect(buildRecoveryPackets(current).filter(packet => packet.channel !== 'chatbot').every(packet => packet.state === 'review-ready')).toBe(true)

    const stale = copy()
    stale.snapshot.chatbot.latestAt = older
    stale.bindings.find(binding => binding.channel === 'chatbot')!.observed.latestAt = older
    const stalePacket = buildRecoveryPackets(stale).find(packet => packet.channel === 'chatbot')!
    expect(stalePacket.historicalFreshness).toBe('stale')
    expect(stalePacket.state).toBe('review-ready')
    expect(stalePacket.blockers).toEqual([])
  })

  it('accepts a monthly report at the review instant and the 31-day mark', () => {
    const nowMs = Date.parse(input.now)
    const atNow = copy()
    atNow.report.generatedAt = atNow.now
    expect(buildRecoveryPackets(atNow).every(packet => packet.state === 'review-ready')).toBe(true)

    const boundary = copy()
    boundary.report.generatedAt = new Date(nowMs - 31 * 86400000).toISOString()
    expect(buildRecoveryPackets(boundary).every(packet => packet.state === 'review-ready')).toBe(true)

    for (const generatedAt of [new Date(nowMs - 31 * 86400000 - 1).toISOString(), new Date(nowMs + 1).toISOString(), 'not-a-time']) {
      const value = copy()
      value.report.generatedAt = generatedAt
      expect(buildRecoveryPackets(value).every(packet => packet.blockers.includes('Monthly report is stale or invalid.'))).toBe(true)
    }
  })

  it('keeps attempt bounds at 1 through 3 and blocks an expiry equal to the review instant', () => {
    for (const attempt of [
      { maxAttempts: 1, maxRetries: 0, expiresAt: '2026-11-02T15:00:00.001Z' },
      { maxAttempts: 3, maxRetries: 2, expiresAt: '2026-11-02T15:00:00.001Z' },
    ]) {
      const value = copy()
      value.bindings[0].attempt = attempt
      expect(buildRecoveryPackets(value).find(packet => packet.channel === 'chatbot')?.state).toBe('review-ready')
    }
    for (const attempt of [
      { maxAttempts: 4, maxRetries: 3, expiresAt: '2026-11-10T00:00:00Z' },
      { maxAttempts: 2, maxRetries: 2, expiresAt: '2026-11-10T00:00:00Z' },
      { maxAttempts: 2, maxRetries: 1, expiresAt: '2026-11-02T15:00:00.000Z' },
      { maxAttempts: 2.5, maxRetries: 1, expiresAt: '2026-11-10T00:00:00Z' },
    ]) {
      const value = copy()
      value.bindings[0].attempt = attempt
      expect(buildRecoveryPackets(value).find(packet => packet.channel === 'chatbot')?.blockers).toEqual(['Bounded attempt policy is missing or expired.'])
    }
  })

  it('blocks one malformed canonical family without blocking the other channels', () => {
    const duplicated = copy()
    duplicated.manifest.families.push(structuredClone(duplicated.manifest.families[0]))
    const duplicatePackets = buildRecoveryPackets(duplicated)
    expect(duplicatePackets.find(packet => packet.channel === 'chatbot')?.blockers).toEqual(['Canonical family is missing, duplicated, or mismatched.'])
    expect(duplicatePackets.filter(packet => packet.channel !== 'chatbot').every(packet => packet.state === 'review-ready')).toBe(true)

    const ungated = copy()
    ungated.manifest.families.find(family => family.id === ids.agent)!.mode = 'local'
    expect(buildRecoveryPackets(ungated).find(packet => packet.channel === 'agent')?.blockers).toEqual(['Canonical family is missing, duplicated, or mismatched.'])

    const wrongKey = copy()
    wrongKey.manifest.families.find(family => family.id === ids['llm-judge'])!.evidence.snapshotKey = 'chatbot'
    expect(buildRecoveryPackets(wrongKey).find(packet => packet.channel === 'llm-judge')?.blockers).toEqual(['Canonical family is missing, duplicated, or mismatched.'])
  })

  it('blocks a revision that is not the same lowercase commit', () => {
    const drifted = copy()
    drifted.report.commit = 'b'.repeat(40)
    expect(buildRecoveryPackets(drifted).every(packet => packet.blockers.includes('Monthly report revision mismatch.'))).toBe(true)

    const upper = copy()
    upper.baseCommit = 'C2D76AC59ADD75434FA98B6F91C32A5D381B01BA'
    upper.report.commit = upper.baseCommit
    expect(buildRecoveryPackets(upper).every(packet => packet.blockers.includes('Monthly report revision mismatch.'))).toBe(true)
  })

  it('blocks a repeated prior identity even when the digest matches', () => {
    const first = buildRecoveryPackets(copy())
    const replay = copy()
    replay.previous = [
      { key: first[0].key, digest: first[0].digest },
      { key: first[0].key, digest: first[0].digest },
    ]
    expect(buildRecoveryPackets(replay)[0].blockers).toEqual(['Conflicting or duplicate prior packet identity.'])
  })

  it('blocks rating, provenance, candidate, and baseline contradictions', () => {
    const ratings = copy()
    ratings.bindings[0].observed.humanRatings = { good: 1, bad: 6 }
    expect(buildRecoveryPackets(ratings).find(packet => packet.channel === 'chatbot')?.blockers).toEqual(['Human rating breakdown does not match persisted count.'])

    const provenance = copy()
    provenance.bindings[0].observed.provenance = ' \n\t '
    expect(buildRecoveryPackets(provenance).find(packet => packet.channel === 'chatbot')?.blockers).toEqual(['Observation provenance is missing.'])

    const candidate = copy()
    candidate.bindings[0].candidate = { id: 'candidate-x', scriptId: 'script-x', templateId: 'template-x', evidenceId: 'approval-x', approved: true, channel: 'video-script', version: 'v1' }
    expect(buildRecoveryPackets(candidate).find(packet => packet.channel === 'chatbot')?.blockers).toEqual(['Candidate is only valid for video-script baseline.'])

    const baseline = copy()
    const video = baseline.bindings.find(binding => binding.channel === 'video-script')!
    video.observed.latestAt = '2026-10-02T15:00:00.000Z'
    baseline.snapshot['video-script'].latestAt = '2026-10-02T15:00:00.000Z'
    const videoPacket = buildRecoveryPackets(baseline).find(packet => packet.channel === 'video-script')!
    expect(videoPacket.historicalFreshness).toBe('absent')
    expect(videoPacket.blockers).toEqual(['First baseline must have zero historical evaluations.'])
  })
})
