import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate as validateBindings } from '../validate.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../../..')
const register = JSON.parse(readFileSync(path.join(here, '../source-register.json')))
const crosswalk = JSON.parse(readFileSync(path.join(here, '../curriculum-crosswalk.json')))
const filenames = [
  'L01-job-and-receipt.md',
  'L02-decision.md',
  'L03-trace-and-sources.md',
  'L04-memory-and-routing.md',
]

export function validatePackets() {
  const errors = validateBindings(register, crosswalk)
  const registered = new Set(register.sources.map((source) => source.path))
  for (const [index, filename] of filenames.entries()) {
    const lesson = crosswalk.lessons[index]
    const file = path.join(here, filename)
    if (!existsSync(file)) { errors.push(`${filename}: missing`); continue }
    const packet = readFileSync(file, 'utf8')
    if (!packet.startsWith(`# L${String(index + 1).padStart(2, '0')} — ${lesson.title}`)) errors.push(`${filename}: title differs from crosswalk`)
    for (const source of [...lesson.chapter_sources, lesson.workbook_source]) {
      if (!registered.has(source) || !packet.includes(path.relative(here, path.join(root, source)))) errors.push(`${filename}: missing registered source citation ${source}`)
    }
    for (const output of lesson.workbook_outputs) if (!packet.includes(output)) errors.push(`${filename}: missing workbook output ${output}`)
    for (const visual of lesson.visual_candidates) if (!registered.has(visual) || !packet.includes(visual)) errors.push(`${filename}: missing visual candidate binding ${visual}`)
    for (const heading of ['## Timed narration and screen', '## Exercise and model Operating File entry', '## Storyboard-ready visual briefs']) if (!packet.includes(heading)) errors.push(`${filename}: missing ${heading}`)
    for (const field of ['**Outcome:**', '**Run time:**', '**Operating File update:**', '**Source bindings:**', '**Avatar/B-roll:**', '**Pronunciation:**', '**Accessibility:**', '**Editorial hold:**']) if (!packet.includes(field)) errors.push(`${filename}: missing ${field}`)
    if (!packet.includes(lesson.operating_file_artifact)) errors.push(`${filename}: missing Operating File artifact ${lesson.operating_file_artifact}`)
    if (/!\[[^\]]*\]\([^)]*\)/.test(packet)) errors.push(`${filename}: embedded media is not approved`)
    if (/\/Users\/|https?:\/\/|(?:password|api key|token)\s*[:=]\s*\S+/i.test(packet)) errors.push(`${filename}: possible private path, external asset, or secret`)
    if (!/review candidate|only a candidate/i.test(packet)) errors.push(`${filename}: visual candidate boundary missing`)
    if (!/synthetic|invented|fictional/i.test(packet)) errors.push(`${filename}: synthetic evidence boundary missing`)
  }
  return errors
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = validatePackets()
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1 }
  else console.log('L01–L04: registered sources, crosswalk outputs, packet sections, and media boundaries pass.')
}
