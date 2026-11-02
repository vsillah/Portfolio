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
  report: { commit: 'c2d76ac59add75434fa98b6f91c32a5d381b01ba', generatedAt: '2026-11-02T10:49:50Z', snapshotSha256: sha, results: channels.map(channel => ({ id: ids[channel], status: channel === 'video-script' ? 'absent' : 'stale' })), errors: channels.map(channel => `${ids[channel]}: ${channel === 'video-script' ? 'absent' : 'stale'} evidence`) },
  snapshot, snapshotSha256: sha, baseCommit: 'c2d76ac59add75434fa98b6f91c32a5d381b01ba', now: '2026-11-02T15:00:00Z', bindings,
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
})
