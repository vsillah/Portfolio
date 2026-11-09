import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { assertCaptionMatches, expectedCaptionText, extractSrtText, extractVttText, splitSentences } from './caption-contract.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')

test('keeps a sentence closed by a Markdown backtick', () => {
  const text = 'Write a `not_run` reason: `No agreed comparison set.` Then continue.'
  assert.deepEqual(splitSentences(text), [
    'Write a `not_run` reason: `No agreed comparison set.`',
    'Then continue.',
  ])
})

for (const lessonId of ['L13', 'L14', 'L15', 'L16']) {
  test(`${lessonId} SRT and VTT preserve the exact approved spoken text`, () => {
    const id = lessonId.toLowerCase()
    const candidate = JSON.parse(readFileSync(path.join(root, `agentified/workshop/l13-l16-continuous-preflight/${id}-request-candidate.json`)))
    const expected = expectedCaptionText(candidate)
    const srt = readFileSync(path.join(here, `agentified-${id}-native-captions.srt`), 'utf8')
    const vtt = readFileSync(path.join(here, `agentified-${id}-native-captions.vtt`), 'utf8')
    assert.equal(assertCaptionMatches(extractSrtText(srt), expected, `${lessonId} SRT`), true)
    assert.equal(assertCaptionMatches(extractVttText(vtt), expected, `${lessonId} VTT`), true)
  })
}

test('fails closed when approved caption words are absent', () => {
  const candidate = JSON.parse(readFileSync(path.join(root, 'agentified/workshop/l13-l16-continuous-preflight/l13-request-candidate.json')))
  const expected = expectedCaptionText(candidate)
  const incomplete = expected.replace('Write a `not_run` reason that another person can act on: `No agreed comparison set or reviewer protocol; staffing hold remains unresolved.` ', '')
  assert.throws(() => assertCaptionMatches(incomplete, expected, 'L13 SRT'), /L13 SRT transcript drift/)
})
