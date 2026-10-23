import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import serviceConceptGallery from './service-concept-gallery.json'
import { resolveServiceGallery } from './showcase-preview'

type CatalogRow = { id: string; title: string; image_url: string | null; video_url: string | null }
const catalog = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/showcase-audit/services-catalog-2026-10-23.json'), 'utf8')) as { count: number; rows: CatalogRow[] }

describe('active service gallery coverage', () => {
  it('binds every active catalog service to two distinct, local, source-bound frames', () => {
    expect(catalog.count).toBe(41)
    expect(catalog.rows).toHaveLength(41)
    expect(new Set(catalog.rows.map((row) => row.id)).size).toBe(41)
    expect(Object.keys(serviceConceptGallery)).toHaveLength(41)
    const allPaths: string[] = []
    const allAlts: string[] = []
    for (const row of catalog.rows) {
      const frames = resolveServiceGallery(row.id, row.image_url)
      expect(frames).toHaveLength(2)
      expect(frames.map((frame) => frame.role)[0]).toBe('hero')
      expect(new Set(frames.map((frame) => frame.imageUrl)).size).toBe(2)
      for (const frame of frames) {
        expect(frame.status).toMatch(/source capture|illustrative concept|public source review|illustrative proposal/)
        expect(frame.alt.length).toBeGreaterThan(35)
        expect(frame.imageUrl).not.toContain('service-gallery-v3')
        expect(frame.imageUrl.startsWith('/showcases/')).toBe(true)
        expect(readFileSync(path.join(process.cwd(), 'public', frame.imageUrl)).length).toBeGreaterThan(0)
        allPaths.push(frame.imageUrl)
        allAlts.push(frame.alt)
      }
    }
    expect(new Set(allPaths).size).toBe(82)
    expect(new Set(allAlts).size).toBe(82)
    expect(resolveServiceGallery(catalog.rows[0].id, '/changed-image.png').map((frame) => frame.imageUrl)).toEqual(['/changed-image.png'])
  })

  it('distinguishes the Julie public source review from the proposed revision', () => {
    const julie = catalog.rows.find((row) => row.title === 'Website UX Refresh')!
    const frames = resolveServiceGallery(julie.id, julie.image_url)
    expect(frames.map((frame) => frame.status)).toEqual(['public source review', 'illustrative proposal'])
    expect(frames[0].alt).toMatch(/public/i)
    expect(frames[1].alt).toMatch(/propos/i)
  })

  it('keeps the self-paced course poster separate from playable video', () => {
    const course = catalog.rows.find((row) => row.id === 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2')!
    expect(course.video_url).toBeNull()
    expect(resolveServiceGallery(course.id, course.image_url).map((frame) => frame.role)).toEqual(['hero', 'course-preview poster'])
  })

  it('binds the revised chatbot and course visuals to product-specific descriptions and local sources', () => {
    const chatbot = resolveServiceGallery('a479ce70-4856-4d3f-917b-c37bfff1f0a2', null)
    const course = resolveServiceGallery('e5c198bd-1276-45ee-abe3-9d9f85e1e3d2', null)
    expect([...chatbot, ...course].every((frame) => frame.imageUrl.endsWith('-product-calibration-r2.webp'))).toBe(true)
    expect(chatbot[0].alt).toMatch(/receptionist.*headset/i)
    expect(chatbot[1].alt).toMatch(/qualification.*human handoff.*follow-up/i)
    expect(course[0].alt).toMatch(/roundtable training/i)
    expect(course[1].alt).toMatch(/modules.*workbook.*progress.*implementation-plan/i)
    for (const source of ['chatbot-receptionist-source.png', 'training-roundtable-source.png']) {
      expect(readFileSync(path.join(process.cwd(), 'public/showcases/service-calibration/sources', source)).length).toBeGreaterThan(0)
    }
  })
})
