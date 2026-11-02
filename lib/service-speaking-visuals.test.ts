import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveServiceGallery } from './showcase-preview'

const root = process.cwd()
const read = (file: string) => readFileSync(path.join(root, file), 'utf8')
const speakingId = 'a278e803-9328-490b-bf57-8fbee7d129ee'

function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map((part) => parseInt(part, 16) / 255)
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrast(first: string, second: string) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a)
  return (values[0] + 0.05) / (values[1] + 0.05)
}

describe('public service theme and speaking visuals', () => {
  it('uses two distinct local photographic-style raster scenes with honest status', () => {
    const frames = resolveServiceGallery(speakingId, null)
    expect(frames).toHaveLength(2)
    expect(frames.map((frame) => frame.role)).toEqual(['hero', 'product-in-use'])
    expect(frames.every((frame) => frame.status === 'illustrative concept' && frame.label === 'Illustrative scene')).toBe(true)
    expect(frames.every((frame) => /illustrative scene of Vambah/i.test(frame.alt))).toBe(true)
    const files = frames.map((frame) => {
      expect(frame.imageUrl).toMatch(/^\/showcases\/speaking\/.*\.jpg$/)
      const file = readFileSync(path.join(root, 'public', frame.imageUrl))
      expect(file.subarray(0, 3).toString('hex')).toBe('ffd8ff')
      expect(file.byteLength).toBeGreaterThan(100_000)
      return createHash('sha256').update(file).digest('hex')
    })
    expect(new Set(files).size).toBe(2)
    expect(resolveServiceGallery(speakingId, '/changed-source.jpg').map((frame) => frame.imageUrl)).toEqual(['/changed-source.jpg'])
  })

  it('keeps the catalog, card, detail, and carousel theme semantic', () => {
    const catalog = read('app/services/page.tsx')
    const card = read('components/ServiceCard.tsx')
    const detailSource = read('app/services/[id]/page.tsx')
    const detail = detailSource.slice(0, detailSource.indexOf('  if (visualCapture)')) + detailSource.slice(detailSource.lastIndexOf('  return (\n    <div className="min-h-screen bg-background text-foreground">'))
    const carousel = read('components/ShowcaseCarousel.tsx')
    const navigation = read('components/Navigation.tsx')
    for (const content of [catalog, card, detail, carousel]) {
      expect(content).not.toMatch(/bg-black|bg-gray-900|text-gray-[34]00/)
      expect(content).toMatch(/text-(foreground|card-foreground|muted-foreground)/)
    }
    expect(card).not.toMatch(/text-white mb-2|text-white.*formatDollarAmount/)
    expect(card).toMatch(/min-w-0.*overflow-hidden/)
    expect(catalog).toMatch(/grid-cols-1 md:grid-cols-2 lg:grid-cols-3/)
    expect(catalog).toMatch(/flex gap-2 flex-wrap/)
    expect(detail).toMatch(/flex flex-col gap-6.*sm:flex-row/)
    expect(navigation).toMatch(/href="\/auth\/login"\s+className="[^"]*text-foreground/)
    expect(navigation).toMatch(/const linkClassName = "[^"]*hover:text-foreground/)
  })

  it('preserves readable primary button states in both themes', () => {
    const css = read('app/globals.css')
    for (const state of ['', ':hover:not(:disabled)', ':active:not(:disabled)', ':focus-visible', ':disabled']) {
      expect(css).toContain(`.service-primary-action${state}`)
    }
    for (const content of [read('app/services/page.tsx'), read('components/ServiceCard.tsx'), read('app/services/[id]/page.tsx')]) {
      expect(content).toContain('service-primary-action')
    }
    // 4.5:1 is the WCAG AA threshold for normal label text.
    expect(contrast('#121e31', '#d4af37')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#121e31', '#f5d060')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#121e31', '#c59d28')).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#121e31', '#e8ecf2')).toBeGreaterThanOrEqual(4.5)
  })
})
