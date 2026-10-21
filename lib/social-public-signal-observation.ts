import { createHash } from 'crypto'
import { isIP } from 'net'

export const PUBLIC_OBSERVATION_VERSION = 'public_signal_observation_v1' as const
export type ObservationInput = {
  coverage_identity: string
  source_url: string
  observed_at: string
  expires_at: string
  public_attention: { observed: number; required: number }
  relevance: { observed: number; required: number }
  evidence_note: string
  observation_identity?: string
  official_packet_id?: string
  excluded?: boolean
}

export function validPublicObservation(input: unknown, now: string): input is ObservationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false
  const value = input as Partial<ObservationInput>
  let url: URL
  try { url = new URL(String(value.source_url)) } catch { return false }
  const observed = Date.parse(String(value.observed_at))
  const expires = Date.parse(String(value.expires_at))
  const current = Date.parse(now)
  const pair = (v: unknown) => {
    if (!v || typeof v !== 'object') return false
    const p = v as { observed?: unknown; required?: unknown }
    return typeof p.observed === 'number' && Number.isFinite(p.observed) && p.observed >= 0
      && typeof p.required === 'number' && Number.isFinite(p.required) && p.required > 0
  }
  return typeof value.coverage_identity === 'string' && /^[a-z0-9_:-]{8,120}$/i.test(value.coverage_identity)
    && url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.')
    && !isIP(url.hostname) && !['localhost', '127.0.0.1'].includes(url.hostname)
    && !['.local', '.internal', '.invalid', '.test'].some((suffix) => url.hostname.endsWith(suffix))
    && Number.isFinite(current) && Number.isFinite(observed) && Number.isFinite(expires)
    && observed <= current && observed >= current - 7 * 86400000
    && expires > current && expires <= observed + 7 * 86400000
    && pair(value.public_attention) && pair(value.relevance)
    && typeof value.evidence_note === 'string' && value.evidence_note.trim().length >= 20 && value.evidence_note.length <= 500
}

export function publicObservationIdentity(input: ObservationInput) {
  const canonical = {
    version: PUBLIC_OBSERVATION_VERSION, coverage_identity: input.coverage_identity,
    source_url: input.source_url, observed_at: input.observed_at, expires_at: input.expires_at,
    public_attention: input.public_attention, relevance: input.relevance,
    evidence_note: input.evidence_note.trim(),
  }
  return `public-observation:${createHash('sha256').update(JSON.stringify(canonical)).digest('hex')}`
}
