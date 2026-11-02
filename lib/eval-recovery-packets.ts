/** Review-only hosted evaluation recovery packets. This module has no provider or database imports. */
import { createHash } from 'node:crypto'

export const RECOVERY_FAMILIES = {
  chatbot: 'chatbot-hosted-evidence',
  'llm-judge': 'llm-judge-hosted-evidence',
  'video-script': 'video-script-hosted-evidence',
  agent: 'agent-hosted-evidence',
} as const
export type RecoveryChannel = keyof typeof RECOVERY_FAMILIES
type ManifestFamily = { id: string; owner: string; mode: string; threshold: { kind: string; source: string }; freshness: { maxAgeDays: number }; evidence: { snapshotKey?: string }; remediation: { owner: string; route: string } }
export type RecoveryManifest = { families: ManifestFamily[] }
export type RecoverySnapshot = Record<string, { count: number; latestAt: string | null }>
export type RecoveryReport = { commit: string; generatedAt: string; snapshotSha256: string; results: Array<{ id: string; status: string }>; errors: string[] }
export type ApprovedBinding = {
  channel: RecoveryChannel
  familyId: string
  version: { kind: 'prompt' | 'rubric' | 'template'; value: string; source: string }
  source: { id: string; revision: string; approvalId: string; evidenceSha256: string; channel: RecoveryChannel; familyId: string; version: string; approved: boolean }
  candidate?: { id: string; scriptId: string; templateId: string; evidenceId: string; approved: boolean; channel: 'video-script'; version: string }
  observed: { count: number; latestAt: string | null; provenance: string; humanRatings?: { good: number; bad: number }; judgeRatings?: { good: number; bad: number; aligned: number; misaligned: number }; agentRubric?: { key: string; threshold: number; average: number; passed: number; failed: number } }
  attempt: { maxAttempts: number; maxRetries: number; expiresAt: string }
}
export type RecoveryInput = {
  manifest: RecoveryManifest; report: RecoveryReport; snapshot: RecoverySnapshot
  snapshotSha256: string; baseCommit: string; now: string; bindings: ApprovedBinding[]
  previous?: Array<{ key: string; digest: string }>
}
export type RecoveryPacket = {
  key: string; digest: string; state: 'review-ready' | 'blocked' | 'idempotent-replay'; blockers: string[]
  channel: RecoveryChannel; familyId: string; baseCommit: string; version: ApprovedBinding['version']
  threshold: ManifestFamily['threshold'] & { requiredValue: number | null }
  source: ApprovedBinding['source']; candidate: ApprovedBinding['candidate'] | null
  observed: ApprovedBinding['observed']; historicalFreshness: 'absent' | 'stale' | 'current'
  owner: string; remediation: string; attempt: ApprovedBinding['attempt']
  sideEffects: { provider: 'disabled'; production: 'disabled'; execution: 'review-only' }
}
const sha = (value: unknown) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex')
const validSha = (value: string) => /^[a-f0-9]{64}$/.test(value)
const validTime = (value: string | null) => value !== null && !Number.isNaN(Date.parse(value))

export function buildRecoveryPackets(input: RecoveryInput): RecoveryPacket[] {
  const now = Date.parse(input.now)
  if (!Number.isFinite(now)) throw new Error('Invalid review timestamp')
  const seen = new Set<string>()
  return input.bindings.map(binding => {
    const blockers: string[] = []
    const expectedId = RECOVERY_FAMILIES[binding.channel]
    const families = input.manifest.families.filter(f => f.id === expectedId)
    const family = families[0]
    if (families.length !== 1 || !family || family.mode !== 'gated' || family.evidence.snapshotKey !== binding.channel) blockers.push('Canonical family is missing, duplicated, or mismatched.')
    if (binding.familyId !== expectedId) blockers.push('Channel/family mismatch.')
    if (input.report.commit !== input.baseCommit || !/^[a-f0-9]{40}$/.test(input.baseCommit)) blockers.push('Monthly report revision mismatch.')
    if (!validSha(input.snapshotSha256) || input.report.snapshotSha256 !== input.snapshotSha256) blockers.push('Approved snapshot digest mismatch.')
    if (!validTime(input.report.generatedAt) || Date.parse(input.report.generatedAt) > now || now - Date.parse(input.report.generatedAt) > 31 * 86400000) blockers.push('Monthly report is stale or invalid.')
    if (!input.report.results.some(r => r.id === expectedId) || input.report.results.filter(r => r.id === expectedId).length !== 1) blockers.push('Monthly family result is missing or ambiguous.')
    if (!input.report.errors.some(error => error.startsWith(`${expectedId}: `))) blockers.push('Monthly remediation route has no matching finding.')
    const snapshot = input.snapshot[binding.channel]
    if (!snapshot || snapshot.count !== binding.observed.count || snapshot.latestAt !== binding.observed.latestAt) blockers.push('Observed count or timestamp differs from approved snapshot.')
    if (!binding.observed.provenance.trim()) blockers.push('Observation provenance is missing.')
    const kind = binding.channel === 'agent' ? 'rubric' : binding.channel === 'video-script' ? 'template' : 'prompt'
    if (binding.version.kind !== kind || !binding.version.value.trim() || !binding.version.source.trim()) blockers.push('Current version binding is missing or mismatched.')
    if (!binding.source.approved || !binding.source.id || !binding.source.revision || !binding.source.approvalId || !validSha(binding.source.evidenceSha256)) blockers.push('Approved source identity is incomplete.')
    if (binding.source.channel !== binding.channel || binding.source.familyId !== expectedId || binding.source.version !== binding.version.value) blockers.push('Source channel, family, or version mismatch.')
    if (!Number.isInteger(binding.attempt.maxAttempts) || binding.attempt.maxAttempts < 1 || binding.attempt.maxAttempts > 3 || !Number.isInteger(binding.attempt.maxRetries) || binding.attempt.maxRetries < 0 || binding.attempt.maxRetries >= binding.attempt.maxAttempts || !validTime(binding.attempt.expiresAt) || Date.parse(binding.attempt.expiresAt) <= now) blockers.push('Bounded attempt policy is missing or expired.')
    if (binding.channel === 'video-script') {
      const candidate = binding.candidate
      if (!candidate?.approved || candidate.channel !== 'video-script' || candidate.version !== binding.version.value || !candidate.id || !candidate.scriptId || !candidate.templateId || candidate.templateId !== binding.source.id || candidate.evidenceId !== binding.source.approvalId) blockers.push('No eligible approved script/template/evidence candidate.')
      if (binding.observed.count !== 0 || binding.observed.latestAt !== null) blockers.push('First baseline must have zero historical evaluations.')
    } else if (binding.candidate) blockers.push('Candidate is only valid for video-script baseline.')
    if (binding.channel === 'chatbot' && (!binding.observed.humanRatings || binding.observed.humanRatings.good + binding.observed.humanRatings.bad !== binding.observed.count)) blockers.push('Human rating breakdown does not match persisted count.')
    if (binding.channel === 'llm-judge' && (!binding.observed.judgeRatings || binding.observed.judgeRatings.good + binding.observed.judgeRatings.bad !== binding.observed.count || binding.observed.judgeRatings.aligned + binding.observed.judgeRatings.misaligned !== binding.observed.count)) blockers.push('Judge rating or human alignment breakdown does not match persisted count.')
    if (binding.channel === 'agent' && (!binding.observed.agentRubric || binding.observed.agentRubric.key !== 'chief-of-staff-synthesis-quality' || binding.observed.agentRubric.threshold !== 82 || binding.observed.agentRubric.average !== 76.8 || binding.observed.agentRubric.passed !== 2 || binding.observed.agentRubric.failed !== 3 || binding.observed.count !== 5)) blockers.push('Agent rubric identity, threshold, or historical score provenance mismatch.')
    const threshold = { ...(family?.threshold ?? { kind: 'missing', source: 'missing' }), requiredValue: binding.channel === 'agent' ? 82 : null }
    if (binding.channel === 'video-script' && family?.threshold.kind !== 'zero-blockers') blockers.push('Video-script zero-blocker threshold mismatch.')
    if ((binding.channel === 'chatbot' || binding.channel === 'llm-judge') && family?.threshold.kind !== 'reviewed-per-record-rating') blockers.push('Human rating threshold semantics mismatch.')
    if (binding.channel === 'agent' && family?.threshold.kind !== 'per-rubric-score') blockers.push('Agent threshold source mismatch.')
    const key = sha([binding.channel, expectedId, input.baseCommit, binding.version.value, binding.source.id, binding.source.revision, binding.candidate?.id ?? null])
    const digest = sha([key, input.snapshotSha256, binding.observed, binding.attempt, threshold, binding.source, binding.candidate ?? null])
    if (seen.has(key)) blockers.push('Duplicate packet identity in this review.')
    seen.add(key)
    const matchingPrevious = (input.previous ?? []).filter(p => p.key === key)
    if (matchingPrevious.length > 1 || matchingPrevious.some(p => p.digest !== digest)) blockers.push('Conflicting or duplicate prior packet identity.')
    const latest = snapshot?.latestAt ? Date.parse(snapshot.latestAt) : NaN
    const historicalFreshness = !snapshot?.count || !snapshot.latestAt ? 'absent' : !Number.isFinite(latest) || latest > now || now - latest > (family?.freshness.maxAgeDays ?? 31) * 86400000 ? 'stale' : 'current'
    if (input.report.results.find(r => r.id === expectedId)?.status !== historicalFreshness) blockers.push('Monthly finding and snapshot freshness mismatch.')
    if (historicalFreshness === 'current') blockers.push('Historical evidence is current; refresh packet is not needed.')
    return { key, digest, state: blockers.length ? 'blocked' : matchingPrevious.length ? 'idempotent-replay' : 'review-ready', blockers, channel: binding.channel, familyId: expectedId, baseCommit: input.baseCommit, version: binding.version, threshold, source: binding.source, candidate: binding.candidate ?? null, observed: binding.observed, historicalFreshness, owner: family?.remediation.owner ?? 'unrouted', remediation: family?.remediation.route ?? 'unrouted', attempt: binding.attempt, sideEffects: { provider: 'disabled', production: 'disabled', execution: 'review-only' } } satisfies RecoveryPacket
  })
}
