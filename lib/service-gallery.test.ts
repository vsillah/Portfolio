import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveServiceGallery } from './showcase-preview'

type CatalogRow = { id: string; title: string; image_url: string | null; video_url: string | null }
const catalog = JSON.parse(readFileSync(path.join(process.cwd(), 'docs/showcase-audit/services-catalog-2026-10-23.json'), 'utf8')) as { count: number; rows: CatalogRow[] }

describe('active service gallery coverage', () => {
  it('covers the public catalog without inventing missing media', () => {
    expect(catalog.count).toBe(41)
    expect(catalog.rows).toHaveLength(41)
    expect(new Set(catalog.rows.map((row) => row.id)).size).toBe(41)
    for (const row of catalog.rows) {
      const frames = resolveServiceGallery(row.id, row.image_url)
      if (frames.length === 0) expect(row.image_url).toBeNull()
      for (const frame of frames) {
        expect(frame.status).toMatch(/source capture|illustrative concept/)
        if (frame.imageUrl.startsWith('/')) {
          expect(readFileSync(path.join(process.cwd(), 'public', frame.imageUrl)).length).toBeGreaterThan(0)
        }
      }
    }
    expect(catalog.rows.filter((row) => resolveServiceGallery(row.id, row.image_url).length === 2)).toHaveLength(6)
    expect(catalog.rows.filter((row) => resolveServiceGallery(row.id, row.image_url).length === 1)).toHaveLength(4)
    expect(catalog.rows.filter((row) => resolveServiceGallery(row.id, row.image_url).length === 0)).toHaveLength(31)
  })

  it('keeps the self-paced course poster separate from playable video', () => {
    const course = catalog.rows.find((row) => row.id === 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2')!
    expect(course.video_url).toBeNull()
    expect(resolveServiceGallery(course.id, course.image_url).map((frame) => frame.role)).toEqual(['hero', 'course-preview poster'])
  })
})
