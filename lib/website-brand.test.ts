import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { WEBSITE_BRAND_NAME, WEBSITE_COMPANY_NAME } from './website-brand'
import { COMPANY_DISPLAY_NAME } from './pdf-brand-styles'
import { SMS_DISCLOSURE, SMS_DISCLOSURE_VERSION, SMS_PROGRAM } from './contact-sms-consent'
import protectedSources from '../docs/qa/website-llc-naming/protected-source-tokens.json'
import approvedArtifacts from '../docs/qa/website-llc-naming/approved-artifacts-sha256.json'

describe('website company naming boundaries', () => {
  it('uses one comma/suffix for short and full display names', () => {
    expect(WEBSITE_BRAND_NAME).toBe('AmaduTown, LLC')
    expect(WEBSITE_COMPANY_NAME).toBe('AmaduTown Advisory Solutions, LLC')
    expect(COMPANY_DISPLAY_NAME).toBe(WEBSITE_COMPANY_NAME)
    expect(SMS_PROGRAM).toBe(WEBSITE_COMPANY_NAME)
    expect(SMS_DISCLOSURE).toContain(`from ${WEBSITE_COMPANY_NAME} about`)
    expect(SMS_DISCLOSURE).toContain(`${WEBSITE_BRAND_NAME} will not sell`)
    expect(SMS_DISCLOSURE).not.toMatch(/LLC(?:,?\s+LLC|[^.]*Solutions)/)
    expect(SMS_DISCLOSURE_VERSION).toBe('amadutown-sms-2026-09-09-v2')
  })

  it('preserves URLs, addresses, asset paths, technical names and Vambah’s personal name', () => {
    for (const { file, tokens } of protectedSources) {
      const source = readFileSync(file, 'utf8')
      for (const token of tokens) expect(source, `${file}: ${token}`).toContain(token)
      expect(source).not.toMatch(/Vambah Sillah, LLC|LLC,? LLC|LLC\\u00A0Solutions/)
    }
  })

  it('keeps every approved v1 artifact and the migration byte-for-byte intact', () => {
    for (const { file, sha256 } of approvedArtifacts) {
      expect(createHash('sha256').update(readFileSync(file)).digest('hex'), file).toBe(sha256)
    }
  })
})
