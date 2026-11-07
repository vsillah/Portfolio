import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
export const here = path.join(repo, 'agentified/workshop/scene-production')
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const read = (p) => readFileSync(path.join(repo, p))
const map = JSON.parse(read('agentified/workshop/curriculum-crosswalk.json'))
const approved = JSON.parse(read('agentified/workshop/visual-review/packets.json'))
const register = JSON.parse(read('agentified/workshop/source-register.json'))
const sourceByPath = new Map(register.sources.map((x) => [x.path, x]))
const sceneForVisual = {
  L01: [4], L02: [4], L03: [2], L04: [4], L05: [4], L06: [3], L07: [5], L08: [5],
  L09: [2, 4], L10: [3], L11: [2], L12: [3], L13: [2], L14: [3, 4], L15: [4], L16: [4, 5],
}
const seconds = (clock) => { const [m, s] = clock.split(':').map(Number); return m * 60 + s }
const captionCues = (narration, start, end) => {
  const text = narration.replace(/^“|”$/g, '')
  const segments = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)].map((x) => x.segment)
  const words = text.trim().split(/\s+/).length
  const speaking = Math.min(end - start, Math.ceil(words / 2.25))
  let cursor = start
  return segments.map((segment, i) => {
    const next = i === segments.length - 1 ? start + speaking : cursor + speaking * (segment.length / text.length)
    const cue = { start_seconds: Number(cursor.toFixed(3)), end_seconds: Number(next.toFixed(3)), text: segment }
    cursor = next
    return cue
  })
}
const cells = (row) => row.trim().slice(1, -1).split(' | ').map((cell) => cell.trim())
const audienceLines = (raw) => [...raw.matchAll(/“([^”]+)”/g)].map((m) => m[1])

export function buildPacket(number) {
  const lesson = map.lessons[number - 1]
  if (!lesson || lesson.lesson !== number) throw new Error(`missing lesson ${number}`)
  const id = `L${String(number).padStart(2, '0')}`
  const file = readdirSync(path.join(repo, 'agentified/workshop/scripts')).find((name) => name.startsWith(`${id}-`) && name.endsWith('.md'))
  if (!file) throw new Error(`${id}: script missing`)
  const scriptPath = `agentified/workshop/scripts/${file}`
  const script = read(scriptPath).toString()
  const approval = approved.lessons.find((x) => x.id === id)
  if (!approval || approval.script_sha256 !== sha(read(scriptPath))) throw new Error(`${id}: script approval drift`)
  const rows = script.split('\n').filter((line) => /^\| \d{1,2}:\d{2}–\d{1,2}:\d{2} \|/.test(line))
  if (rows.length !== 8) throw new Error(`${id}: expected eight timed beats`)
  const exercise = script.match(/^\*\*Prompt:\*\* (.+)$/m)?.[1] ?? ''
  const scenes = rows.map((row, index) => {
    const [range, narration, onScreen] = cells(row)
    const [from, to] = range.split('–')
    const start = seconds(from), end = seconds(to)
    const visualBindings = approval.visuals.filter((visual, visualIndex) => sceneForVisual[id][visualIndex] === index + 1).map((visual) => ({
      path: visual.source_path, sha256: visual.register_sha256, approval_record: visual.approval.record,
      identity: visual.source_identity, use: visual.intended_production_use,
    }))
    const lines = audienceLines(onScreen)
    const isExercise = lines.length === 0
    return {
      id: `${id}-${String(index + 1).padStart(2, '0')}`, beat: index + 1,
      start_seconds: start, end_seconds: end, source_time: range,
      narration_exact: narration, on_screen_copy_exact: onScreen,
      audience_copy: lines, audience_copy_state: isExercise ? 'pause_only_source_instruction_withheld' : 'exact_script_quotes',
      exercise_prompt_exact: isExercise ? exercise : null,
      composition: visualBindings.length ? 'approved plate in independent contain region; separate teaching copy' : isExercise ? 'quiet writing timer and blank workspace' : 'synthetic type cards on neutral field',
      approved_visuals: visualBindings,
      motion: visualBindings.length ? 'static hold; no crop, pan, or zoom on plate' : '150 ms opacity entrance on each text card; reduced motion uses instant cut',
      captions: captionCues(narration, start, end),
      avatar_window: index === 0 ? { start_seconds: start, end_seconds: Math.min(end, start + 20), state: 'reserved_unfilled' } : index === 7 ? { start_seconds: Math.max(start, end - 15), end_seconds: end, state: 'reserved_unfilled' } : null,
      b_roll: visualBindings.length ? 'approved static plate only; no product, participant, or live system footage' : 'none; synthetic layout only',
      audio_ownership: 'exact scripted narration reserved; no voice rendered; silence after provisional caption span',
      transition: index === 0 ? 'open on static frame' : 'straight cut; no content overlap',
      accessibility: { captions: 'sentence cues from exact narration; timing provisional until a human voice track exists', text_equivalent: visualBindings.length ? 'approved plate needs final scene-specific text alternative before publication' : 'audience text and exact narration transcript', reduced_motion: 'instant cut; no entrance animation', reading_order: 'title, teaching copy, visual, caption' },
      status: 'provider_free_review_only',
    }
  })
  const exactNarration = scenes.map((scene) => scene.narration_exact).join('\n')
  return {
    schema_version: 1, id, title: lesson.title, base_commit: '0eed3e63014390038f4f6550cf0f3971c4b526ee',
    script_path: scriptPath, script_sha256: sha(read(scriptPath)), narration_sha256: sha(exactNarration),
    approved_visual_packet_sha256: sha(read('agentified/workshop/visual-review/packets.json')),
    source_register_sha256: sha(read('agentified/workshop/source-register.json')),
    crosswalk_sha256: sha(read('agentified/workshop/curriculum-crosswalk.json')),
    workbook_source: { path: lesson.workbook_source, sha256: sourceByPath.get(lesson.workbook_source)?.sha256 },
    chapter_sources: lesson.chapter_sources.map((p) => ({ path: p, sha256: sourceByPath.get(p)?.sha256 })),
    learning_outcome: lesson.learning_outcome, exercise: lesson.exercise, workbook_outputs: lesson.workbook_outputs,
    operating_file: { artifact: lesson.operating_file_artifact, revision: number, status: 'draft', update_exact: script.match(/^\*\*Operating File update:\*\* (.+)$/m)?.[1] ?? '' },
    continuity: { case: 'Harbor Learning Circle', owner: 'Morgan', source_ids: [...new Set(script.match(/SYN-[A-Z0-9-]+/g) ?? [])] },
    boundaries: { evidence: lesson.evidence_boundary, privacy: 'synthetic Harbor only; no actual participant, client, admin, or private corpus content', authority: 'prepare_only; no live agent, memory promotion, message, booking, spending, or publication', provider_execution: 'disabled', accelerated_sam_media: 'lineage_only_excluded' },
    timing_seconds: scenes.at(-1).end_seconds, scenes,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const batch = process.argv[2]
  const ranges = { 'L01-L04': [1, 4], 'L05-L08': [5, 8], 'L09-L12': [9, 12], 'L13-L16': [13, 16] }
  if (!ranges[batch]) throw new Error('Choose L01-L04, L05-L08, L09-L12, or L13-L16')
  mkdirSync(path.join(here, 'packets'), { recursive: true })
  for (let n = ranges[batch][0]; n <= ranges[batch][1]; n++) {
    const packet = buildPacket(n)
    writeFileSync(path.join(here, 'packets', `${packet.id}.json`), JSON.stringify(packet, null, 2) + '\n')
    console.log(`${packet.id}: ${packet.scenes.length} scenes, ${packet.timing_seconds}s, ${packet.scenes.flatMap((s) => s.approved_visuals).length} approved visual use(s)`)
  }
}
