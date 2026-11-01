import { describe, expect, it } from 'vitest'
import { verifiedDarkCastleApprovedArtifacts } from './dark-castle-approved-artifacts'

describe('approved Dark Castle review artifacts', () => {
  it('matches the shipped master and Direction C thumbnail bytes to their receipts', async () => {
    await expect(verifiedDarkCastleApprovedArtifacts()).resolves.toMatchObject({
      masterSha256: '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36',
      thumbnailDirection: 'C',
      thumbnailSha256: '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0',
    })
  })
})
