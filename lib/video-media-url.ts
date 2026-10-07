/** Shared by server gates and browser players. Never treats a provider link as durable media. */
export const VIDEO_ARCHIVE_BUCKET = 'generated-video-private'
export const VIDEO_MEDIA_RECOVERY = 'Open Video Generation. Refresh the provider link if needed, then recover the private archive.'
export function archiveReference(id: string) { return `portfolio-video:${id}` }
export function archiveId(value: unknown): string | null {
  return typeof value === 'string' && /^portfolio-video:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value.slice(16) : null
}
export function classifyVideoUrl(value: unknown, now = Date.now()) {
  if (archiveId(value)) return { kind: 'archive' as const, expired: false, expiresAt: null, reason: null }
  try {
    const u = new URL(String(value))
    if (u.protocol !== 'https:' || u.username || u.password || u.port) throw new Error()
    const provider = /(^|\.)heygen\.(ai|com)$/.test(u.hostname)
    const params = new Map([...u.searchParams].map(([k, v]) => [k.toLowerCase(), v]))
    let expiration: number | null = null
    if (params.has('expires')) expiration = Number(params.get('expires')) * 1000
    if (params.has('x-amz-date') && params.has('x-amz-expires')) {
      const date = params.get('x-amz-date')!.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')
      expiration = Date.parse(date) + Number(params.get('x-amz-expires')) * 1000
    }
    const temporary = provider || params.has('signature') || params.has('x-amz-signature') || expiration !== null
    const expired = expiration !== null && (!Number.isFinite(expiration) || expiration <= now + 60_000)
    return { kind: temporary ? 'provider_temporary' as const : 'remote' as const, expired, expiresAt: expiration && Number.isFinite(expiration) ? new Date(expiration).toISOString() : null,
      reason: expired ? 'Provider video link expired. Private archive recovery is required.' : temporary ? 'Temporary provider video needs a private archive before review.' : 'Video has no verified private archive.' }
  } catch { return { kind: 'invalid' as const, expired: true, expiresAt: null, reason: 'Video URL is missing or unusable.' } }
}
