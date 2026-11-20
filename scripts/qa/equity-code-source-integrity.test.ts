import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path))
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const navigationChrome = `<link rel="stylesheet" href="/insights/equity-code/return-navigation.css">
<nav class="insight-return-nav" aria-label="Dashboard navigation">
  <a href="/" class="insight-return-nav__home">← Back to AmaduTown</a>
  <a href="/insights">All insights</a>
</nav>
`
const withoutNavigation = (path: string) => {
  const html = source(path).toString('utf8')
  expect(html.split(navigationChrome)).toHaveLength(2)
  return Buffer.from(html.replace(`<div class="wrap">\n${navigationChrome}`, '<div class="wrap">'))
}

describe('Equity Code source integrity', () => {
  it('keeps the uncorrected dashboards byte-identical', () => {
    expect(sha256(withoutNavigation('public/insights/equity-code/home-front-ledger.html')))
      .toBe('79f992fa0c00ac2cfde194b66d415e618dbdc40569ae9718e9f11a9df59bb79b')
    expect(sha256(withoutNavigation('public/insights/equity-code/owning-the-block.html')))
      .toBe('d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b')
  })

  it('changes only the Compounding Graph label-layout block', () => {
    const original = source('docs/insights/source-snapshots/compounding-graph.1822a76e.html')
    const corrected = withoutNavigation('public/insights/equity-code/compounding-graph.html')
    expect(sha256(original)).toBe('1822a76ec480782f14e873677dc77104680b212b3b534e6129608ea6420fef99')
    expect(sha256(corrected)).toBe('a207a6738e5392f114aba65350c526e9b532ab6471c67e72b1057e25970f3d80')

    const oldText = original.toString('utf8')
    const newText = corrected.toString('utf8')
    const oldStart = oldText.indexOf("Object.keys(spokes).forEach(function(p){var a=spokes[p]*Math.PI/180;var t=el('text'")
    const newStart = newText.indexOf('var spokeT={}; Object.keys(spokes).forEach(function(p){')
    const endMarker = '/* color modes */'
    const oldEnd = oldText.indexOf(endMarker, oldStart)
    const newEnd = newText.indexOf(endMarker, newStart)
    expect(Math.min(oldStart, newStart, oldEnd, newEnd)).toBeGreaterThan(0)

    // These unchanged regions contain the event data, relationships, figures,
    // citations, color rules, control wiring, and interaction handlers.
    expect(newText.slice(0, newStart)).toBe(oldText.slice(0, oldStart))
    expect(newText.slice(newEnd)).toBe(oldText.slice(oldEnd))
  })

  it('provides the same accessible return paths on all three dashboards', () => {
    for (const name of ['compounding-graph', 'home-front-ledger', 'owning-the-block']) {
      const html = source(`public/insights/equity-code/${name}.html`).toString('utf8')
      expect(html).toContain(navigationChrome)
      expect(html.indexOf(navigationChrome)).toBeLessThan(html.indexOf('<h1>'))
    }
    const css = source('public/insights/equity-code/return-navigation.css').toString('utf8')
    expect(css).toContain('flex-wrap: wrap')
    expect(css).toContain(':focus-visible')
  })
})
