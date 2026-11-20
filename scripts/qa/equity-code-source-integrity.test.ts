import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const source = (path: string) => readFileSync(join(root, path))
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const replaceOnce = (text: string, pattern: RegExp, replacement: string) => {
  expect([...text.matchAll(new RegExp(pattern.source, 'g'))]).toHaveLength(1)
  return text.replace(pattern, replacement)
}

const owningSourceWithoutThemeAndSkyline = () => {
  let html = source('public/insights/equity-code/owning-the-block.html').toString('utf8')
  html = replaceOnce(html, /\n<style id="owning-the-block-light-theme">[\s\S]*?<\/style>\n/, '\n')
  html = replaceOnce(html, /\.boston-skyline\{[^\n]*\}\n\.boston-skyline \.clock\{[^\n]*\}\n/, '')
  html = replaceOnce(html, /\.utility-underlay\{[^\n]*\}\n\.utility-underlay \.access\{[^\n]*\}\n/, '')
  html = replaceOnce(html, /          <g class="boston-skyline" aria-hidden="true">[\s\S]*?          <\/g>\n/, '')
  html = replaceOnce(html, /          <g class="utility-underlay" aria-hidden="true">[\s\S]*?          <\/g>\n/, '')
  html = replaceOnce(html, /function buildingOutline\(n\)\{[\s\S]*?\n\}\n(?=N\.forEach)/, '')
  const originalShape = "  const r=el('rect',{x:n.x,y:n.y,width:n.w,height:n.h,rx:n.kind==='sky'?4:2,class:'shape',fill:colorOf(n),'fill-opacity':n.kind==='bld'||n.kind==='rent'?'.16':'.22',stroke:colorOf(n),'stroke-width':n.kind==='rent'?'1.5':'1','stroke-dasharray':n.kind==='rent'?'5 4':'none'});"
  html = replaceOnce(html, /  const outline=buildingOutline\(n\);\n  const r=el\(outline\?'path':'rect',[^\n]*/, originalShape)
  return Buffer.from(html)
}

describe('Equity Code source integrity', () => {
  it('keeps the Ledger dashboard byte-identical and Block content unchanged beneath bounded theme and skyline geometry', () => {
    expect(sha256(source('public/insights/equity-code/home-front-ledger.html')))
      .toBe('79f992fa0c00ac2cfde194b66d415e618dbdc40569ae9718e9f11a9df59bb79b')
    expect(sha256(owningSourceWithoutThemeAndSkyline()))
      .toBe('d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b')
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
