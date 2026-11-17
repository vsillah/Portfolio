import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ACCELERATED_ACTIVATION_ITEMS, ACCELERATED_EXCLUDED_X_ID, ACCELERATED_EXCLUDED_X_CALENDAR_ID,
  approvedMediaBinding, approvedRasterUrls, hasExactAcceleratedRasterBinding, isAcceleratedActivationId,
  isAcceleratedActivationCalendarId, isAcceleratedCampaignRecordId, sha256, verifiedRasterHashes,
  evaluateAcceleratedActivation,
} from './accelerated-campaign-activation'

const ids = Object.keys(ACCELERATED_ACTIVATION_ITEMS)

describe('three visual Accelerated activation records', () => {
  it('keeps X protected but outside the activation allowlist', async () => {
    expect(ids).toHaveLength(3)
    expect(isAcceleratedActivationId(ACCELERATED_EXCLUDED_X_ID)).toBe(false)
    expect(isAcceleratedCampaignRecordId(ACCELERATED_EXCLUDED_X_ID)).toBe(true)
    expect(isAcceleratedActivationCalendarId(ACCELERATED_EXCLUDED_X_CALENDAR_ID)).toBe(true)
    const result = await evaluateAcceleratedActivation({ id: ACCELERATED_EXCLUDED_X_ID, item: null, calendar: null, publishes: [], config: null })
    expect(result.ready).toBe(false)
    expect(result.blockers).toContain('Record is outside the approved three-record activation scope.')
  })

  it.each(ids)('binds deterministic public URLs to the exact approved raster bytes for %s', async id => {
    const expected = ACCELERATED_ACTIVATION_ITEMS[id as keyof typeof ACCELERATED_ACTIVATION_ITEMS]
    const urls = approvedRasterUrls(expected.assetCount)
    const localHashes = await verifiedRasterHashes(expected.assetCount)
    expect(urls).toHaveLength(expected.assetCount)
    expect(urls.every((url, index) => url === `https://amadutown.com/campaigns/accelerated/2026-11/slide-${String(index + 1).padStart(2, '0')}.png`)).toBe(true)
    for (let index = 0; index < urls.length; index++) {
      const bytes = await readFile(path.join(process.cwd(), 'public/campaigns/accelerated/2026-11', `slide-${String(index + 1).padStart(2, '0')}.png`))
      expect(sha256(bytes)).toBe(localHashes[index])
    }
    const bound = expected.assetCount === 1 ? { image_url: urls[0] } : { carousel_slide_urls: urls }
    expect(approvedMediaBinding(expected.assetCount)).toEqual(expected.assetCount === 1
      ? { image_url: urls[0], carousel_slide_urls: null }
      : { image_url: null, carousel_slide_urls: urls })
    expect(hasExactAcceleratedRasterBinding(bound, expected.assetCount)).toBe(true)
    expect(hasExactAcceleratedRasterBinding({ ...bound, image_url: 'https://other.example/slide-01.png' }, expected.assetCount)).toBe(expected.assetCount !== 1)
    expect(hasExactAcceleratedRasterBinding({ carousel_slide_urls: urls.slice().reverse() }, expected.assetCount)).toBe(false)
  })
})
