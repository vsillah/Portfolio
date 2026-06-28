import fs from 'fs'
import path from 'path'

const root = process.cwd()
const packetPath = path.join(root, 'docs', 'accelerated-course-modules', 'module-production-packets.md')
const statusPath = path.join(root, 'docs', 'accelerated-course-modules', 'review-status.json')
const brollPath = path.join(root, 'docs', 'accelerated-course-modules', 'broll-capture-list.md')
const sourcePath = path.join(root, 'docs', 'accelerated-course-modules', 'source-register.md')

function read(filePath: string) {
  return fs.readFileSync(filePath, 'utf8')
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

const packet = read(packetPath)
const broll = read(brollPath)
const source = read(sourcePath)
const status = JSON.parse(read(statusPath)) as {
  provider_execution_status?: string
  modules?: Array<Record<string, string>>
}

const moduleMatches = [...packet.matchAll(/^## Module ([0-7]) - (.+)$/gm)]
assert(moduleMatches.length === 8, `Expected 8 module sections; found ${moduleMatches.length}`)

for (let index = 0; index < moduleMatches.length; index += 1) {
  const current = moduleMatches[index]
  const next = moduleMatches[index + 1]
  const moduleNumber = current[1]
  const title = current[2]
  const start = current.index ?? 0
  const end = next?.index ?? packet.length
  const section = packet.slice(start, end)

  assert(moduleNumber === String(index), `Expected Module ${index}; found Module ${moduleNumber}`)
  assert(section.includes('**Book spine:**'), `Module ${index} missing book spine`)
  assert(section.includes('**Lesson outcome:**'), `Module ${index} missing lesson outcome`)
  assert(section.includes('**Proof cue:**'), `Module ${index} missing proof cue`)
  assert(section.includes('### Primary Lesson Script Draft'), `Module ${index} missing lesson script`)
  assert(section.includes('### Video Packet'), `Module ${index} missing video packet`)
  assert(section.includes('HeyGen'), `Module ${index} missing HeyGen direction`)
  assert(section.includes('ElevenLabs'), `Module ${index} missing ElevenLabs option`)
  assert(section.includes('Remotion/HyperFrames'), `Module ${index} missing composition direction`)
  assert(section.includes('YouTube Shorts cutdown'), `Module ${index} missing Shorts cutdown`)
  assert(section.includes('Thumbnail concepts'), `Module ${index} missing thumbnail concepts`)
  assert(section.includes('### Worksheet Prompt'), `Module ${index} missing worksheet prompt`)
  assert(section.includes('### Privacy Checklist'), `Module ${index} missing privacy checklist`)
  assert(title.trim().length > 0, `Module ${index} title is empty`)
}

assert(status.provider_execution_status === 'locked_until_explicit_approval', 'Provider execution must stay locked')
assert(Array.isArray(status.modules) && status.modules.length === 8, 'review-status.json must contain 8 modules')
for (const moduleStatus of status.modules ?? []) {
  assert(moduleStatus.review_status === 'draft', `${moduleStatus.id} review_status must be draft`)
  assert(moduleStatus.render_status === 'not_started', `${moduleStatus.id} render_status must be not_started`)
  assert(moduleStatus.privacy_status === 'needs_screen_review', `${moduleStatus.id} privacy_status must require screen review`)
}

for (const expected of ['HeyGen', 'ElevenLabs', 'Remotion', 'HyperFrames', 'B-roll capture']) {
  assert(packet.includes(expected) || source.includes(expected), `Missing production stack reference: ${expected}`)
}

for (const route of ['/tools/audit', '/admin/value-evidence', '/admin/chat-eval', '/admin/module-sync']) {
  assert(broll.includes(route), `B-roll list missing route ${route}`)
}

for (const forbidden of ['Provider calls, uploads, rendering, scheduling, and publishing remain locked', 'Do not call provider generation']) {
  assert(packet.includes(forbidden), `Missing safety boundary text: ${forbidden}`)
}

console.log('Accelerated course module package validated: 8 modules, video packets, proof cues, exercises, and safety gates present.')
