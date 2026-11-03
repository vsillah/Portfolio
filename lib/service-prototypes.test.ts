import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { prototypeForService, prototypeForSlug, prototypeGallery, SERVICE_PROTOTYPES } from './service-prototypes'

describe('six service prototype bindings', () => {
  it('binds exactly six known services to three distinct captured views', () => {
    expect(Object.keys(SERVICE_PROTOTYPES)).toHaveLength(6)
    const all = new Set<string>()
    for (const [id, prototype] of Object.entries(SERVICE_PROTOTYPES)) {
      expect(prototypeForSlug(prototype.slug)).toEqual(prototype)
      expect(prototypeForService(id, null)).toEqual(prototype)
      const gallery = prototypeGallery(id, null)
      expect(gallery).toHaveLength(3)
      expect(gallery.map((frame) => frame.role)).toEqual(['hero', 'product-in-use', 'product-in-use'])
      for (const frame of gallery) {
        expect(frame.status).toBe('source capture')
        expect(frame.alt).toContain(prototype.title)
        const file = readFileSync(path.join(process.cwd(), 'public', frame.imageUrl))
        expect(file.subarray(0, 4).toString()).toBe('RIFF')
        expect(file.length).toBeGreaterThan(30_000)
        expect(all.has(frame.imageUrl)).toBe(false)
        all.add(frame.imageUrl)
      }
    }
    expect(all.size).toBe(18)
  })

  it('fails closed for an unknown ID or a changed source image', () => {
    expect(prototypeGallery('unknown', null)).toEqual([])
    expect(prototypeGallery(Object.keys(SERVICE_PROTOTYPES)[0], '/changed-image.png')).toEqual([])
    expect(prototypeForSlug('unknown')).toBeNull()
  })
})
