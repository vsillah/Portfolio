/** Shared queue-release contract. No credentials, database or provider imports. */
export function socialReleaseGate(ragContext: unknown): Record<string, unknown> {
  const context = ragContext && typeof ragContext === 'object' ? ragContext as Record<string, unknown> : {}
  const gate = context.platform_submission_gate
  return gate && typeof gate === 'object' && !Array.isArray(gate) ? gate as Record<string, unknown> : {}
}

export function isSocialReleaseLocked(ragContext: unknown): boolean {
  return Object.keys(confirmedSocialPlatforms(ragContext)).length > 0 || ['partially_submitted', 'claimed', 'submitting', 'publishing', 'uncertain', 'ambiguous', 'submitted'].includes(String(socialReleaseGate(ragContext).status))
}

export function nextSocialReleaseVersion(current: unknown, now = Date.now()): string {
  const parsed = typeof current === 'string' ? Date.parse(current) : NaN
  return new Date(Math.max(now, Number.isFinite(parsed) ? parsed + 1 : now)).toISOString()
}

/** Recorded receipts keep content immutable even during a fresh remaining-target approval. */
export function confirmedSocialPlatforms(ragContext: unknown): Record<string, string> {
  const value = socialReleaseGate(ragContext).confirmed_platforms
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {}
}

export function hasAmbiguousSocialPublishRows(rows: Record<string, unknown>[]): boolean {
  return rows.some(row => row.status === 'published'
    ? typeof row.platform_post_id !== 'string' || !row.platform_post_id
    : row.status !== 'pending' || Boolean(row.platform_post_id || row.platform_post_url || row.published_at))
}
