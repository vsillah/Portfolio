import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import lesson from './animatic.json'
import request from './heygen-request.json'
import assets from './asset-map.json'
import approved from '../visual-production/manifest.json'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

describe('L01 review packet', () => {
  it('keeps the exact approved narration and contiguous nine minute scenes', () => {
    const source = approved.lessons.find((item) => item.id === 'L01')!
    expect(lesson.scenes).toHaveLength(6)
    expect(lesson.scenes[0].start_seconds).toBe(0)
    expect(lesson.scenes.at(-1)?.end_seconds).toBe(540)
    expect(lesson.scenes[2].on_screen_copy).toBe('Signals · Alignment · Momentum')
    expect(lesson.scenes.every((scene) => !scene.on_screen_copy.includes(' / '))).toBe(true)
    lesson.scenes.forEach((scene, index) => {
      expect(scene.start_seconds).toBe(index ? lesson.scenes[index - 1].end_seconds : 0)
      expect(scene.narration).toBe(source.scenes[index].narration)
      expect(hash(scene.narration)).toBe(scene.narration_sha256)
    })
    expect(hash(readFileSync('docs/accelerated-course-modules/curriculum/scripts/L01.md'))).toBe(lesson.source_script_sha256)
  })

  it('keeps review captions complete and bounded by their scenes', () => {
    lesson.scenes.forEach((scene) => {
      const cues = lesson.cues.filter((cue) => cue.scene === scene.id)
      expect(cues.map((cue) => cue.text).join(' ')).toBe(scene.narration)
      expect(cues[0].start).toBe(scene.start_seconds)
      expect(cues.at(-1)?.end).toBe(scene.end_seconds)
      expect(cues.every((cue) => cue.start >= scene.start_seconds && cue.end <= scene.end_seconds)).toBe(true)
    })
    const srt = readFileSync('docs/accelerated-course-modules/l01-guided-video/l01-review.srt', 'utf8')
    expect(srt.trim().split(/\n\n/)).toHaveLength(lesson.cues.length)
  })

  it('locks provider execution and uses public or synthetic assets', () => {
    expect(request.execution_allowed).toBe(false)
    expect(request.upload_allowed).toBe(false)
    expect(request.spend_cap_usd).toBe(0)
    expect(request.segments.reduce((sum, item) => sum + item.duration_seconds, 0)).toBe(100)
    expect(assets.assets.every((asset) => /public|approved|fictional|blank/i.test(asset.status))).toBe(true)
    assets.assets.filter((asset) => asset.path.startsWith('public/')).forEach((asset) => {
      expect(hash(readFileSync(asset.path))).toBe(asset.sha256)
    })
    request.segments.forEach((segment) => {
      const scene = lesson.scenes.find((item) => item.id === segment.scene)!
      expect(scene.narration).toContain(segment.narration_text)
      expect(segment.timing_status).toMatch(/storyboard estimate/)
    })
  })
})
