import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveServiceGallery } from './showcase-preview'

type CatalogRow = { id: string; title: string; image_url: string | null; video_url: string | null }
const catalog = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/showcase-audit/services-catalog-2026-10-23.json'), 'utf8')) as { count: number; rows: CatalogRow[] }

describe('active service gallery coverage', () => {
  it('limits the active concepts to three source-bound calibration pairs', () => {
    expect(catalog.count).toBe(41)
    expect(catalog.rows).toHaveLength(41)
    expect(new Set(catalog.rows.map((row) => row.id)).size).toBe(41)
    const calibrationIds = new Set([
      'd1d32ad7-5cb6-4d6c-8f15-d9ccf24f9e78',
      'a479ce70-4856-4d3f-917b-c37bfff1f0a2',
      'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2',
    ])
    for (const row of catalog.rows) {
      const frames = resolveServiceGallery(row.id, row.image_url)
      expect(frames).toHaveLength(calibrationIds.has(row.id) ? 2 : row.image_url ? 1 : 0)
      if (calibrationIds.has(row.id)) {
        expect(new Set(frames.map((frame) => frame.imageUrl)).size).toBe(2)
        expect(frames.every((frame) => frame.status === 'illustrative concept')).toBe(true)
      }
      for (const frame of frames) {
        expect(frame.status).toMatch(/source capture|illustrative concept/)
        expect(frame.imageUrl).not.toContain('service-gallery-v3')
        if (frame.imageUrl.startsWith('/')) {
          expect(readFileSync(path.join(process.cwd(), 'public', frame.imageUrl)).length).toBeGreaterThan(0)
        }
      }
    }
    expect(resolveServiceGallery(catalog.rows[0].id, '/changed-image.png').map((frame) => frame.imageUrl)).toEqual(['/changed-image.png'])
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
