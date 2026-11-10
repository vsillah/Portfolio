import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import sourceBindings from './accelerated-end-screen-bindings.json'
import parityBindings from './accelerated-visual-parity-bindings.json'
import sourceManifest from '../docs/accelerated-course-modules/visual-production/manifest.json'
import receipt from '../artifacts/accelerated-visual-parity-2026-11-10/scene-receipt.json'

const root = path.resolve(__dirname, '..')
const hash = (file: string) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')

describe('Accelerated visual parity binding', () => {
  it('binds all 98 remastered scenes to the unchanged script and exact scene windows', () => {
    expect(receipt.scene_count).toBe(98)
    const scenes = sourceManifest.lessons.flatMap((lesson) => lesson.scenes)
    expect(receipt.scenes.map((scene) => scene.scene_id)).toEqual(scenes.map((scene) => scene.id))
    expect(receipt.source_manifest_sha256).toBe(hash('docs/accelerated-course-modules/visual-production/manifest.json'))
    expect(receipt.scene_concepts_sha256).toBe(hash('scripts/qa/accelerated-scene-concepts.tsv'))
    const art = {
      sam: 'public/showcases/service-prototypes/accelerated-sam-infographic.png',
      signals: 'public/showcases/service-prototypes/v2/sam-signals-plate.webp',
      alignment: 'public/showcases/service-prototypes/v2/sam-alignment-plate.webp',
      momentum: 'public/showcases/service-prototypes/v2/sam-momentum-plate.webp',
      cover: 'public/accelerated_cover_ebook.jpg',
    }
    for (const [name, file] of Object.entries(art)) expect(receipt.source_art_sha256[name as keyof typeof art]).toBe(hash(file))
    for (const [index, scene] of scenes.entries()) {
      const frame = receipt.scenes[index]
      expect(frame.source_script_sha256).toBe(scene.script_sha256)
      expect(scene.script_sha256).toBe(hash(scene.script_path))
      expect(scene.narration_sha256).toBe(createHash('sha256').update(scene.narration).digest('hex'))
      expect(frame.start_seconds).toBe(scene.start_seconds)
      expect(frame.end_seconds).toBe(scene.end_seconds)
      expect(frame.frame_sha256).toBe(hash(frame.frame_path))
      expect(frame.presenter_frame_sha256).toBe(hash(frame.presenter_frame_path))
      expect(frame.title).not.toMatch(/presenter|storyboard|provider|source script|internal|QA/i)
      const segments = 'segments' in frame ? frame.segments : undefined
      if (segments) {
        expect(segments.reduce((total,part) => total + part.duration_seconds, 0)).toBe(scene.duration_seconds)
        for (const part of segments) expect(part.frame_sha256).toBe(hash(part.frame_path))
      }
      if (scene.id === 'L16-06') expect(segments?.map((part) => [part.kind, part.duration_seconds])).toEqual([['sam', 27], ['cover', 45]])
    }
  })

  it('binds each rendered video to its immutable approved source and captions', () => {
    expect(parityBindings.sceneReceiptSha256).toBe(hash('artifacts/accelerated-visual-parity-2026-11-10/scene-receipt.json'))
    expect(parityBindings.lessons).toHaveLength(16)
    expect(parityBindings.lessons.map((lesson) => lesson.lessonId)).toEqual(sourceBindings.lessons.map((lesson) => lesson.lessonId))
    for (const [index, lesson] of parityBindings.lessons.entries()) {
      const source = sourceBindings.lessons[index]
      expect(lesson.sourceVideoSha256).toBe(source.videoSha256)
      expect(lesson.captionSha256).toBe(source.captionSha256)
      expect(lesson.videoSha256).toBe(hash(`public${lesson.videoPath}`))
      expect(lesson.sourceVideoSha256).toBe(hash(`public${source.videoPath}`))
      expect(lesson.captionSha256).toBe(hash(`public${source.captionPath}`))
      expect(lesson.sceneCount).toBe(sourceManifest.lessons[index].scenes.length)
      expect(lesson.durationSeconds).toBe(sourceManifest.lessons[index].runtime_seconds)
    }
  })
})
