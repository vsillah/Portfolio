import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
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
        expect(frame.status).toMatch(/source capture|built example|illustrative concept|public source review|illustrative proposal/)
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

  it('identifies the local KinFlo-built Julie example separately from the proposal', () => {
    const julie = catalog.rows.find((row) => row.title === 'Website UX Refresh')!
    const frames = resolveServiceGallery(julie.id, julie.image_url)
    expect(frames.map((frame) => frame.status)).toEqual(['built example', 'illustrative proposal'])
    expect(frames[0].label).toBe("Example: Julie's Family Learning")
    expect(frames[0].alt).toMatch(/KinFlo-built/i)
    expect(frames[1].alt).toMatch(/propos/i)
    expect(frames[1].alt).toMatch(/KinFlo-built/i)
    expect(frames[1].imageUrl).toMatch(/artifact-review-r2\.webp$/)
    const digitalRenderer = readFileSync(path.join(process.cwd(), 'scripts/showcase/render-digital-review.cjs'), 'utf8')
    expect(digitalRenderer).toMatch(/LOCAL BUILT EXAMPLE \/ KINFLO/)
  })

  it('does not assign duplicate hero files or duplicate rendered hero images', () => {
    const heroPaths = catalog.rows.map((row) => resolveServiceGallery(row.id, row.image_url)[0].imageUrl)
    const heroHashes = heroPaths.map((imageUrl) => createHash('sha256').update(readFileSync(path.join(process.cwd(), 'public', imageUrl))).digest('hex'))
    expect(new Set(heroPaths).size).toBe(heroPaths.length)
    expect(new Set(heroHashes).size).toBe(heroHashes.length)
    const learningRenderer = readFileSync(path.join(process.cwd(), 'scripts/showcase/render-learning-review.cjs'), 'utf8')
    expect(learningRenderer).not.toMatch(/heroKind:'photo'/)
  })

  it('keeps the self-paced course poster separate from playable video', () => {
    const course = catalog.rows.find((row) => row.id === 'e5c198bd-1276-45ee-abe3-9d9f85e1e3d2')!
    expect(course.video_url).toBeNull()
    expect(resolveServiceGallery(course.id, course.image_url).map((frame) => frame.role)).toEqual(['hero', 'course-preview poster'])
  })

  it('fails closed when the service or its current image is not the bound source', () => {
    expect(resolveServiceGallery('not-a-service', null)).toEqual([])
    expect(resolveServiceGallery('not-a-service', undefined)).toEqual([])
    expect(resolveServiceGallery('not-a-service', '')).toEqual([])
    expect(resolveServiceGallery('not-a-service', '/other.png')).toEqual([{
      imageUrl: '/other.png',
      alt: 'Current service listing image',
      role: 'hero',
      status: 'source capture',
    }])

    const boundId = '5e8d9f3d-8dbe-4380-b566-e284ac95a3c7'
    const boundFrames = resolveServiceGallery(boundId, '/ReversR_app.png')
    expect(boundFrames).toHaveLength(2)
    expect(boundFrames.every((frame) => frame.imageUrl.startsWith('/showcases/'))).toBe(true)
    expect(resolveServiceGallery(boundId, null)).toEqual([])
    expect(resolveServiceGallery(boundId, '')).toEqual([])
    expect(resolveServiceGallery(boundId, ' /ReversR_app.png').map((frame) => frame.imageUrl)).toEqual([' /ReversR_app.png'])

    const advisoryId = 'd1d32ad7-5cb6-4d6c-8f15-d9ccf24f9e78'
    expect(resolveServiceGallery(advisoryId, '/replaced.png').map((frame) => frame.imageUrl)).toEqual(['/replaced.png'])
  })

  it('binds five distinct premium service pairs with specific experiences', () => {
    const slugs = ['inbound-lead-chatbot', 'lead-generation-workflow', 'accelerated-cohort', 'premium-masterclass', 'self-paced-course']
    const titles = ['AI Inbound Lead Chatbot', 'Lead Generation Workflow Agent', 'Accelerated Cohort Workshop', 'Premium AI Masterclass', 'AI Training Course — Self-Paced']
    for (let index = 0; index < titles.length; index++) {
      const row = catalog.rows.find((item) => item.title === titles[index])!
      const [hero, experience] = resolveServiceGallery(row.id, row.image_url)
      expect(hero.imageUrl).toBe(`/showcases/service-premium-review/${slugs[index]}-hero-r1.webp`)
      expect(experience.imageUrl).toBe(`/showcases/service-premium-review/${slugs[index]}-experience-r1.webp`)
      expect(hero.status).toBe('illustrative concept')
      expect(experience.status).toBe('illustrative concept')
    }
    const course = resolveServiceGallery('e5c198bd-1276-45ee-abe3-9d9f85e1e3d2', null)
    expect(course[0].alt).toMatch(/Building Smarter Products with AI/i)
    expect(course[1].alt).toMatch(/modules.*workbook.*progress.*first-test output/i)
    for (const source of ['chatbot-receptionist-source.png', 'training-roundtable-source.png']) {
      expect(readFileSync(path.join(process.cwd(), 'public/showcases/service-calibration/sources', source)).length).toBeGreaterThan(0)
    }
  })
})
