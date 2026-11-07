import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const registerPath = path.join(repo, 'agentified/workshop/source-register.json')
const crosswalkPath = path.join(repo, 'agentified/workshop/curriculum-crosswalk.json')
const learnerFields = ['title', 'learning_outcome', 'exercise', 'evidence_boundary']
const leakage = /(?:\/Users\/|(?:api|secret|private)[_-]?key\s*[:=]|Bearer\s+\S+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|https?:\/\/[^\s]+(?:token|key|secret)=)/i
const requiredSources = [
  'agentified/agentified-book-blueprint.md',
  'agentified/manuscript/production-draft/agentified-production-draft.md',
  'agentified/manuscript/workbook/agentified-operating-system-workbook.md',
  'agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md',
  'agentified/manuscript/visuals/agentified-sam-trust-layer-diagrams.md',
  'agentified/manuscript/visuals/source-map.md',
  'public/agentified-cover.jpg',
  'public/agentified-cover.svg',
  'app/agentified/page.tsx',
]

export function validate(register, crosswalk, readSource = (p) => readFileSync(path.join(repo, p))) {
  const errors = []
  const sources = new Map()
  for (const source of register.sources ?? []) {
    if (!source.path || sources.has(source.path)) errors.push(`duplicate or missing source path: ${source.path}`)
    sources.set(source.path, source)
    if (!source.role || !source.sha256 || !source.provenance || !source.rights_status || !source.privacy || !source.allowed_workshop_use) errors.push(`incomplete source binding: ${source.path}`)
    if (source.role === 'rendered visual' && !source.provenance.includes('source-map.md')) errors.push(`unattributed visual: ${source.path}`)
    try {
      const hash = createHash('sha256').update(readSource(source.path)).digest('hex')
      if (hash !== source.sha256) errors.push(`source changed: ${source.path}`)
    } catch { errors.push(`missing source: ${source.path}`) }
  }
  for (const required of requiredSources) if (!sources.has(required)) errors.push(`missing canonical source binding: ${required}`)
  const lessons = crosswalk.lessons ?? []
  if (lessons.length !== 16 || crosswalk.lesson_count !== 16) errors.push('incomplete 16-lesson map')
  const lessonIds = lessons.map((lesson) => lesson.lesson)
  if (new Set(lessonIds).size !== 16 || lessonIds.some((id) => !Number.isInteger(id) || id < 1 || id > 16)) errors.push('invalid or duplicate lesson IDs')
  const chapters = []
  for (const lesson of lessons) {
    for (const key of ['group', 'title', 'learning_outcome', 'exercise', 'operating_file_artifact', 'evidence_boundary']) if (!lesson[key]) errors.push(`lesson ${lesson.lesson}: missing ${key}`)
    if (!lesson.chapters?.length || !lesson.chapter_sources?.length || lesson.chapters.length !== lesson.chapter_sources.length) errors.push(`lesson ${lesson.lesson}: missing chapter bindings`)
    if (!lesson.workbook_outputs?.length || !sources.has(lesson.workbook_source)) errors.push(`lesson ${lesson.lesson}: unbound workbook output`)
    else {
      const workbook = readSource(lesson.workbook_source).toString()
      for (const output of lesson.workbook_outputs) if (!workbook.includes(output)) errors.push(`lesson ${lesson.lesson}: workbook output absent from source: ${output}`)
    }
    if (!lesson.visual_candidates?.length) errors.push(`lesson ${lesson.lesson}: unbound lesson visuals`)
    for (const [index, chapter] of (lesson.chapters ?? []).entries()) {
      chapters.push(chapter)
      const source = lesson.chapter_sources?.[index]
      if (!sources.has(source) || !new RegExp(`/ch${String(chapter).padStart(2, '0')}-`).test(source ?? '')) errors.push(`lesson ${lesson.lesson}: missing chapter source ${chapter}`)
    }
    for (const visual of lesson.visual_candidates ?? []) {
      const source = sources.get(visual)
      if (!source || source.role !== 'rendered visual' || !source.provenance.includes('source-map.md') || source.allowed_workshop_use !== 'lesson-visual-candidate-after-author-review') errors.push(`lesson ${lesson.lesson}: unbound or unattributed visual ${visual}`)
    }
    for (const field of learnerFields) if (leakage.test(lesson[field] ?? '')) errors.push(`lesson ${lesson.lesson}: internal content leakage in ${field}`)
  }
  if (chapters.length !== 26 || new Set(chapters).size !== 26 || chapters.some((n) => !Number.isInteger(n) || n < 1 || n > 26)) errors.push('missing or duplicate chapter coverage')
  const expectedGroups = ['The Harness', 'Authority', 'The Agentified Organization', 'Synthesis and capstone']
  if (expectedGroups.some((group) => !lessons.some((lesson) => lesson.group === group))) errors.push('missing curriculum group')
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validate(JSON.parse(readFileSync(registerPath)), JSON.parse(readFileSync(crosswalkPath)))
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log(`Agentified Phase 1: ${JSON.parse(readFileSync(registerPath)).sources.length} sources, 26 chapters, 16 lessons bound; privacy and attribution gates passed.`)
}
