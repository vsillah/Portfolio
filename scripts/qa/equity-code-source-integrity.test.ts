import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path))
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start)
  const to = text.indexOf(end, from + start.length)
  expect(from).toBeGreaterThanOrEqual(0)
  expect(to).toBeGreaterThan(from)
  return text.slice(from, to + end.length)
}

describe('Equity Code source integrity', () => {
  it('keeps the Ledger byte-identical and binds the original, Claude brief, and corrected Block artifacts', () => {
    expect(sha256(source('public/insights/equity-code/home-front-ledger.html')))
      .toBe('79f992fa0c00ac2cfde194b66d415e618dbdc40569ae9718e9f11a9df59bb79b')
    expect(sha256(source('docs/insights/source-snapshots/owning-the-block.d8cd0ac3.html')))
      .toBe('d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b')
    expect(sha256(source('docs/insights/source-snapshots/owning-the-block.claude-brief.3e48f6e7.md')))
      .toBe('3e48f6e7236103557f5ae0e6b9f9704fb388cedfbe55c1ead591782e4d5d25e6')
    expect(sha256(source('docs/insights/source-snapshots/owning-the-block.f511f78e.html')))
      .toBe('f511f78e35d60bbc6181d01e76aa11dcccccf85026d564acb591003d1dcc4e96')
    expect(sha256(source('docs/insights/source-snapshots/owning-the-block.blueprint-brief.9753a408.md')))
      .toBe('9753a4080c6e34fe713fdde0813cab13e00d0e311328748ab50936b4d7440361')
    expect(sha256(source('public/insights/equity-code/owning-the-block.html')))
      .toBe('1c623afa0472b7e3ac011a416558ba71aa242b58f6f330292d6ff9be5cf0be93')
  })

  it('preserves Block research, connector endpoints, and interaction source blocks', () => {
    const original = source('docs/insights/source-snapshots/owning-the-block.d8cd0ac3.html').toString('utf8')
    const merged = source('docs/insights/source-snapshots/owning-the-block.f511f78e.html').toString('utf8')
    const corrected = source('public/insights/equity-code/owning-the-block.html').toString('utf8')
    for (const [start, end] of [
      ['const N=[', '\n];'],
      ['const WHO={', '\n};'],
      ['const USES=[', '\n];'],
      ['const edges=[];', 'gP.appendChild(p)});'],
      ["g.addEventListener('click'", 'gN.appendChild(g);'],
      ['USES.forEach(u=>{const b=document.createElement', 'usesEl.appendChild(b)});'],
    ]) {
      expect(between(corrected, start, end)).toBe(between(merged, start, end))
      expect(between(corrected, start, end)).toBe(between(original, start, end))
    }
  })

  it('preserves the corrected Compounding Graph source', () => {
    const original = source('docs/insights/source-snapshots/compounding-graph.1822a76e.html')
    const corrected = source('public/insights/equity-code/compounding-graph.html')
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
    expect(newText.slice(0, newStart)).toBe(oldText.slice(0, oldStart))
    expect(newText.slice(newEnd)).toBe(oldText.slice(oldEnd))
  })
})
