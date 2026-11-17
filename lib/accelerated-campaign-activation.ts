import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { projectAcceleratedCampaignReview } from './social-accelerated-campaign-review'
import { projectSocialCalendarPreparation } from './social-calendar-preparation'
import { hasCurrentSocialReleaseApproval } from './social-release-evidence'

export const ACCELERATED_CAMPAIGN_ID = 'b160eab6-1a5a-478d-954a-ca59a3a10e34'
export const ACCELERATED_ACTIVATION_SCOPE = 'accelerated-2026-11-18-20-three-visual-zero-fee-v2'
export const ACCELERATED_EXCLUDED_X_ID = 'd0046271-92ba-4c7f-a009-197b44562f48'
export const ACCELERATED_EXCLUDED_X_CALENDAR_ID = 'af8ed285-69f4-4036-8201-1aa66827bb48'
export const ACCELERATED_PUBLIC_ASSET_ROOT = 'https://amadutown.com/campaigns/accelerated/2026-11/'
const CTA = 'https://amadutown.com/accelerated'
const MANIFEST_HASH = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'
const JIT_HASH = '039488c2ef7fa22f6872617f70060893c49d03ee0936170379a44a2e1f9a18b8'
const ASSET_DIR = 'private-review-assets/accelerated-campaign/carousel-faster-output'
const ASSET_HASHES = [
  '451751db9b30dd24b04667d7d9ecac29e20a1c3f4f4e026644edd2ce1b045b5a',
  '16e4af28026639603119c1d4b17e04b1ac05b1f3ab604bf2d6b37b431429a605',
  'b5012f6eb1758595798ea1753dc0f84a618eb4546ae0ec99d50ac56774c0c1c0',
  '6c9f811db51e3328709bc0dab305c94c91ce3da234e402042ac09cbc4c8c9a10',
  '8294b91c1aefed484b577ab6a9cb5c6e3043cc8f7a71b9d0b66bacd47908272c',
  'e6747b073ca9f8c77fa20e171e873a09add9dbabc392d2b778393d5af1903b9f',
  '124e035d3f96fcde39d09f27d88c6270fcec4c1fa7d7da302d4f432d14fb9ddb',
  '5bd2270ab2460b67d69b6de0f905c5715039a5a4981e007d19585cd9ba920b1f',
]
export function approvedRasterHashes(count: number): string[] { return ASSET_HASHES.slice(0, count) }

export const ACCELERATED_ACTIVATION_ITEMS = {
  '20d09867-24ce-4849-b03d-f877d7114d6a': { calendarId: '796d6523-d600-45cf-96bb-541058af5817', channel: 'linkedin', scheduledFor: '2026-11-18T15:00:00.000Z', copyHash: '78083f810ce16498613f3e1efe0a56f794b7d1638f4b1eda9635bafd6f11106f', assetCount: 1 },
  '9499ecbf-0349-472a-9b12-b6d987d1939d': { calendarId: '07fa29e5-40dc-4b86-9871-a49be6349613', channel: 'linkedin', scheduledFor: '2026-11-20T15:00:00.000Z', copyHash: '1a7dfd942aa1f99530066d7a685c374df20ba5f837357c359644aedb474b0629', assetCount: 8 },
  '34471e82-2cb4-4e06-b3ec-d48f9739bb0f': { calendarId: 'fc23411f-f756-4ed8-8e5b-40ff26cf144e', channel: 'instagram', scheduledFor: '2026-11-20T23:00:00.000Z', copyHash: '6d2e12e180a040287d6b6712e7bc7e9f27ce99f971a68e96c413c1a8df17cb9a', assetCount: 8 },
} as const

export type ActivationId = keyof typeof ACCELERATED_ACTIVATION_ITEMS
export function isAcceleratedCampaignRecordId(id: string): boolean { return id === ACCELERATED_EXCLUDED_X_ID || isAcceleratedActivationId(id) }
export function approvedRasterUrls(count: number): string[] { return Array.from({ length: count }, (_, index) => `${ACCELERATED_PUBLIC_ASSET_ROOT}slide-${String(index + 1).padStart(2, '0')}.png`) }
export function approvedMediaBinding(count: number) {
  const urls = approvedRasterUrls(count)
  return count === 1 ? { image_url: urls[0], carousel_slide_urls: null } : { image_url: null, carousel_slide_urls: urls }
}
export function hasExactAcceleratedRasterBinding(item: Record<string, any>, count: number): boolean {
  const expected = approvedRasterUrls(count)
  const actual = mediaUrls(item, count)
  return actual.length === expected.length && actual.every((url, index) => url === expected[index])
}
export function isAcceleratedActivationId(id: string): id is ActivationId { return Object.prototype.hasOwnProperty.call(ACCELERATED_ACTIVATION_ITEMS, id) }
export function isAcceleratedActivationCalendarId(id: string): boolean {
  return id === ACCELERATED_EXCLUDED_X_CALENDAR_ID || Object.values(ACCELERATED_ACTIVATION_ITEMS).some(item => item.calendarId === id)
}
export function sha256(value: string | Buffer) { return createHash('sha256').update(value).digest('hex') }
function rec(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {} }
function iso(value: unknown) { const time = typeof value === 'string' ? Date.parse(value) : NaN; return Number.isFinite(time) ? new Date(time).toISOString() : '' }
export function matchesApprovedAcceleratedInstant(value: unknown, approvedIso: string): boolean {
  return iso(value) === approvedIso
}
function mediaUrls(item: Record<string, any>, count: number): string[] {
  if (!count) return []
  return count === 1 ? [item.image_url] : Array.isArray(item.carousel_slide_urls) ? item.carousel_slide_urls : []
}

export function configuredAmaduTownAccount(config: Record<string, any> | null, channel: 'linkedin' | 'x' | 'instagram') {
  const settings = rec(config?.settings), credentials = rec(config?.credentials)
  if (config?.platform !== channel || config.is_active !== true || !credentials.access_token) return false
  if (channel === 'linkedin') return settings.author_urn === 'urn:li:person:IXpDF_c4-m' && credentials.person_urn === settings.author_urn
  const scope = typeof credentials.scope === 'string' ? credentials.scope.split(/\s+/) : []
  if (channel === 'x') return settings.connected_account === '@amadutown' && settings.profile_handle === 'amadutown' && scope.includes('tweet.write')
  return settings.instagram_username === 'amadutown' && Boolean(credentials.ig_user_id || credentials.instagram_user_id)
    && settings.instagram_content_publish_permission === true && scope.includes('instagram_content_publish')
}

export function verifiedZeroFeePath(config: Record<string, any> | null) {
  const settings = rec(config?.settings)
  return settings.campaign_zero_fee_verified === true && settings.campaign_zero_fee_cap_usd === 0
}

/** The scheduled raster receipt can satisfy Amina Visuals only for the three exact activation records. */
export function hasApprovedAcceleratedVisualLifecycleEvidence(
  item: Record<string, any>, config: Record<string, any> | null,
  currentCopyHash = acceleratedCopyHash(item),
) {
  if (!isAcceleratedActivationId(String(item.id ?? ''))) return false
  const expected = ACCELERATED_ACTIVATION_ITEMS[item.id as ActivationId]
  const context = rec(item.rag_context), activation = rec(context.accelerated_campaign_activation)
  const gate = rec(context.platform_submission_gate)
  const { publishes: _projectionPublishes, ...persistedItem } = item
  const media = approvedMediaBinding(expected.assetCount)
  const exactMedia = hasExactAcceleratedRasterBinding(item, expected.assetCount)
    && (expected.assetCount === 1
      ? item.image_url === media.image_url && (!Array.isArray(item.carousel_slide_urls) || item.carousel_slide_urls.length === 0)
      : !item.image_url && JSON.stringify(item.carousel_slide_urls) === JSON.stringify(media.carousel_slide_urls))
  return item.status === 'scheduled'
    && item.platform === expected.channel
    && JSON.stringify(item.target_platforms) === JSON.stringify([expected.channel])
    && matchesApprovedAcceleratedInstant(item.scheduled_for, expected.scheduledFor)
    && context.campaign_id === ACCELERATED_CAMPAIGN_ID
    && context.calendar_item_id === expected.calendarId
    && activation.scope === ACCELERATED_ACTIVATION_SCOPE
    && activation.campaign_id === ACCELERATED_CAMPAIGN_ID
    && activation.calendar_item_id === expected.calendarId
    && activation.channel === expected.channel
    && matchesApprovedAcceleratedInstant(activation.scheduled_for, expected.scheduledFor)
    && activation.copy_sha256 === expected.copyHash
    && currentCopyHash === expected.copyHash
    && activation.source_manifest_sha256 === MANIFEST_HASH
    && activation.jit_packet_sha256 === JIT_HASH
    && JSON.stringify(activation.asset_urls) === JSON.stringify(approvedRasterUrls(expected.assetCount))
    && JSON.stringify(activation.asset_sha256) === JSON.stringify(approvedRasterHashes(expected.assetCount))
    && exactMedia
    && activation.fee_usd === 0 && activation.no_spend === true
    && typeof activation.activated_by === 'string' && activation.activated_by.length > 0
    && Number.isFinite(Date.parse(activation.activated_at))
    && gate.status === 'approved'
    && gate.submit_after_approval === false
    && JSON.stringify(gate.platforms) === JSON.stringify([expected.channel])
    // Postgres renders the stored timestamptz as +00:00; the approved
    // fingerprint was made with the equivalent .000Z calendar value.
    && hasCurrentSocialReleaseApproval({ ...persistedItem, scheduled_for: expected.scheduledFor })
    && configuredAmaduTownAccount(config, expected.channel)
    && verifiedZeroFeePath(config)
}

/** The frozen copy includes its CTA, hashtags, and exact channel binding. */
export function acceleratedCopyHash(item: Record<string, any>) {
  return sha256(JSON.stringify([item.post_text, item.cta_text, item.cta_url, item.hashtags, item.platform, item.target_platforms]))
}

export async function verifiedRasterHashes(count: number) {
  const hashes: string[] = []
  for (let index = 0; index < count; index++) {
    const file = path.join(process.cwd(), ASSET_DIR, `slide-${String(index + 1).padStart(2, '0')}.png`)
    hashes.push(sha256(await readFile(file)))
  }
  return hashes
}

export async function evaluateAcceleratedActivation(input: {
  id: string; item: Record<string, any> | null; calendar: Record<string, any> | null
  publishes: Record<string, any>[]; config: Record<string, any> | null; now?: Date
  readAsset?: (url: string) => Promise<Buffer>
}) {
  const blockers: string[] = []
  if (!isAcceleratedActivationId(input.id)) return { ready: false, blockers: ['Record is outside the approved three-record activation scope.'], copyHash: null, scheduledFor: null }
  const expected = ACCELERATED_ACTIVATION_ITEMS[input.id]
  const item = input.item ?? {}, calendar = input.calendar ?? {}, metadata = rec(calendar.metadata), context = rec(item.rag_context)
  const copyHash = acceleratedCopyHash(item)
  if (item.id !== input.id || context.campaign_id !== ACCELERATED_CAMPAIGN_ID || context.calendar_item_id !== expected.calendarId || context.source !== 'social_content_calendar_authorization') blockers.push('Campaign or source identity changed.')
  if (calendar.id !== expected.calendarId || calendar.social_content_id !== input.id || calendar.campaign_id !== ACCELERATED_CAMPAIGN_ID) blockers.push('Canonical calendar binding changed.')
  if (item.platform !== expected.channel || JSON.stringify(item.target_platforms) !== JSON.stringify([expected.channel]) || calendar.channel !== expected.channel || context.channel !== expected.channel) blockers.push('Channel identity changed.')
  if (item.status !== 'draft' || item.scheduled_for || input.publishes.length) blockers.push('A schedule or publish receipt already exists.')
  if (iso(calendar.scheduled_for) !== expected.scheduledFor || iso(context.scheduled_for) !== expected.scheduledFor) blockers.push('The approved calendar time changed.')
  if (Date.parse(expected.scheduledFor) <= (input.now ?? new Date()).getTime()) blockers.push('The approved calendar time is no longer in the future.')
  if (calendar.authorization_status !== 'authorized' || calendar.due_status !== 'planned') blockers.push('Calendar authorization is not current.')
  if (copyHash !== expected.copyHash || item.cta_url !== CTA || metadata.primary_cta_url !== CTA) blockers.push('Approved copy or CTA hash changed.')
  const review = projectAcceleratedCampaignReview({
    id: input.id, status: String(item.status || ''), post_text: String(item.post_text || ''),
    cta_url: typeof item.cta_url === 'string' ? item.cta_url : null,
    updated_at: typeof item.updated_at === 'string' ? item.updated_at : '',
    rag_context: context, calendar_preparation: projectSocialCalendarPreparation(calendar, input.id),
  })
  if (!review?.readyForHumanReview || review.sourceManifestSha256 !== MANIFEST_HASH || review.jitPacketSha256 !== JIT_HASH) blockers.push('Source, JIT, privacy, originality, CTA, or visual review receipt changed.')
  if (context.publish_gate !== (expected.channel === 'linkedin' ? 'draft_only' : 'platform_review_gated')) blockers.push('Campaign publication gate changed.')
  if (metadata.jit_refresh_status !== 'passed_internal_review' || metadata.content_packet_status !== 'human_review_ready') blockers.push('Human-review-ready or JIT status is missing.')
  const jitAt = Date.parse(metadata.jit_refreshed_at)
  const nowMs = (input.now ?? new Date()).getTime()
  if (!Number.isFinite(jitAt) || jitAt > nowMs || nowMs - jitAt > 48 * 60 * 60 * 1000) blockers.push('The JIT refresh is missing or older than 48 hours.')
  const config = input.config ?? {}
  if (!configuredAmaduTownAccount(config, expected.channel)) blockers.push('Configured AmaduTown account or channel integration is unavailable.')
  if (!verifiedZeroFeePath(config)) blockers.push('A verified $0, no-spend execution path is unavailable.')
  const urls = approvedRasterUrls(expected.assetCount)
  const existingUrls = mediaUrls(item, expected.assetCount)
  if (existingUrls.some(Boolean) && !hasExactAcceleratedRasterBinding(item, expected.assetCount)) blockers.push('An existing raster URL differs from the approved public route.')
  try {
    const localHashes = await verifiedRasterHashes(expected.assetCount)
    if (localHashes.some((hash, index) => hash !== ASSET_HASHES[index])) blockers.push('Approved local raster asset hash changed.')
    const publicHashes: string[] = []
    for (let index = 0; index < expected.assetCount; index++) {
      const file = path.join(process.cwd(), 'public/campaigns/accelerated/2026-11', `slide-${String(index + 1).padStart(2, '0')}.png`)
      publicHashes.push(sha256(await readFile(file)))
    }
    if (publicHashes.some((hash, index) => hash !== ASSET_HASHES[index])) blockers.push('Public raster asset hash differs from the approved asset.')
    if (input.readAsset) {
      for (let index = 0; index < urls.length; index++) {
        if (sha256(await input.readAsset(urls[index])) !== ASSET_HASHES[index]) { blockers.push('Platform raster byte hash differs from the approved asset.'); break }
      }
    } else if (expected.assetCount) blockers.push('Public HTTPS raster bytes could not be verified.')
  } catch { blockers.push('Approved raster bytes could not be verified.') }
  return { ready: blockers.length === 0, blockers, copyHash, scheduledFor: expected.scheduledFor, channel: expected.channel, calendarId: expected.calendarId, assetHashes: approvedRasterHashes(expected.assetCount), assetUrls: urls }
}
