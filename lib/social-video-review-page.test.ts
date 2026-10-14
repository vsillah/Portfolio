import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('social video Human QA review page', () => {
  const html = readFileSync(resolve(
    'artifacts/human-qa/artifact-video-review-2026-10-14/index.html',
  ), 'utf8')

  it('separates customer media from expandable QA evidence', () => {
    expect(html.match(/Customer-facing video/g)).toHaveLength(2)
    expect(html.match(/<summary>QA evidence<\/summary>/g)).toHaveLength(2)
    expect(html).toContain('Provenance:')
    expect(html).toContain('Version:')
    expect(html).toContain('Receipts:')
    expect(html).toContain('Traceability:')
    expect(html).toContain('Execution boundary:')
    expect(html).toContain('Validation:')
  })

  it('uses clean customer-facing posters and keeps sidecars outside the video elements', () => {
    expect(html).toContain('poster="jev-customer-facing-poster.png"')
    expect(html).toContain('poster="dark-castle-customer-facing-poster.png"')
    expect(html).toContain('href="jev-provider-none-review.receipt.json"')
    expect(html).toContain('href="dark-castle-provider-none-review.receipt.json"')
    expect(html).not.toMatch(/<video[^>]+(?:sha256|receipt|source:|input version)/i)
  })
})
