import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { agentifiedLessons } from './agentified-workshop'
import { agentifiedLessonPosters, agentifiedPosterAlt } from './agentified-lesson-posters'

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
const manifest = JSON.parse(readFileSync('docs/qa/agentified-lesson-covers/source-map.json', 'utf8')) as {
  baseCommit: string; visualPacketSha256: string; posters: {
    lesson: string; title: string; scriptSha256: string; approvedVisualPath: string;
    approvedVisualSha256: string; rightsStatus: string; canonicalCover: string;
    canonicalCoverSha256: string; identityReference: string; identityReferenceSha256: string;
    avatarSource: string; avatarSourceSha256: string; logo: string; logoSha256: string;
    promptIdentity: string; poseBrief: string; inputIdentity: string; altText: string;
    output: string; outputSha256: string; posterBinding: string; dimensions: number[];
    mediaStatus: string
  }[]
}
const approved = JSON.parse(readFileSync('agentified/workshop/visual-review/packets.json', 'utf8')) as {
  lessons: { id: string; title: string; script_sha256: string; visuals: { source_path: string; register_sha256: string; rights: { workshop_redistribution: string } }[] }[]
}

describe('Agentified lesson covers', () => {
  it('binds sixteen distinct source-bound 16:9 heroes without claiming a video', () => {
    const ids = agentifiedLessons.map(({ id }) => id)
    expect(Object.keys(agentifiedLessonPosters)).toEqual(ids)
    expect(manifest.posters.map(({ lesson }) => lesson)).toEqual(ids)
    expect(manifest.baseCommit).toBe('db010ebfe7c14a378fb4ff2102af48c1b1954293')
    expect(manifest.visualPacketSha256).toBe(hash(readFileSync('agentified/workshop/visual-review/packets.json')))
    expect(new Set(manifest.posters.map(({ outputSha256 }) => outputSha256)).size).toBe(16)
    expect(new Set(manifest.posters.map(({ avatarSourceSha256 }) => avatarSourceSha256)).size).toBe(16)
    for (const [i, entry] of manifest.posters.entries()) {
      const source = approved.lessons[i]
      expect(entry.lesson).toBe(source.id)
      expect(entry.title).toBe(source.title)
      expect(entry.scriptSha256).toBe(source.script_sha256)
      expect(source.visuals.some((visual) => visual.source_path === entry.approvedVisualPath && visual.register_sha256 === entry.approvedVisualSha256 && visual.rights.workshop_redistribution === entry.rightsStatus)).toBe(true)
      expect(entry.rightsStatus).toBe('approved_for_bound_agentified_lesson_uses')
      expect(entry.posterBinding).toBe(agentifiedLessonPosters[entry.lesson as keyof typeof agentifiedLessonPosters])
      expect(entry.output).toBe(`public${entry.posterBinding}`)
      expect(entry.dimensions).toEqual([1280, 720])
      expect(hash(readFileSync(entry.output))).toBe(entry.outputSha256)
      for (const [file, expected] of [[entry.approvedVisualPath, entry.approvedVisualSha256], [entry.canonicalCover, entry.canonicalCoverSha256], [entry.identityReference, entry.identityReferenceSha256], [entry.avatarSource, entry.avatarSourceSha256], [entry.logo, entry.logoSha256]]) expect(hash(readFileSync(file))).toBe(expected)
      expect(entry.promptIdentity).toBe(`agentified-${entry.lesson.toLowerCase()}-static-cover-avatar/v1`)
      expect(entry.inputIdentity).toBe(`${entry.identityReferenceSha256}:${entry.approvedVisualSha256}:${entry.scriptSha256}`)
      expect(entry.poseBrief.length).toBeGreaterThan(12)
      expect(entry.altText).toBe(agentifiedPosterAlt({ id: entry.lesson, title: entry.title }))
      expect(entry.mediaStatus).toBe('static-cover; video locked')
    }
  })
})
