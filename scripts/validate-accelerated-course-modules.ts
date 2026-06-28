import fs from 'fs'
import path from 'path'

const root = process.cwd()
const packetPath = path.join(root, 'docs', 'accelerated-course-modules', 'module-production-packets.md')
const statusPath = path.join(root, 'docs', 'accelerated-course-modules', 'review-status.json')
const brollPath = path.join(root, 'docs', 'accelerated-course-modules', 'broll-capture-list.md')
const sourcePath = path.join(root, 'docs', 'accelerated-course-modules', 'source-register.md')
const module0AssetDir = path.join(root, 'docs', 'accelerated-course-modules', 'module-0-video-assets')

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
const module0Manifest = JSON.parse(read(path.join(module0AssetDir, 'asset-manifest.json'))) as {
  module_id?: string
  asset_packet_status?: string
  provider_execution_status?: string
  target_outputs?: Record<string, unknown>
  provider_assets?: {
    render_handoff_checklist?: string
  }
  safety?: {
    allowed_now?: string[]
    blocked_until_separate_approval?: string[]
    privacy_review_required_before_render?: boolean
  }
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
  if (moduleStatus.id === 'module-0') {
    assert(moduleStatus.review_status === 'approved', 'module-0 review_status must be approved')
    assert(moduleStatus.render_status === 'ready_for_render_preflight', 'module-0 must be ready for render preflight')
    assert(moduleStatus.primary_video_status === 'approved_asset_packet', 'module-0 primary video packet must be approved')
    assert(moduleStatus.asset_packet_path === 'docs/accelerated-course-modules/module-0-video-assets', 'module-0 asset packet path is missing')
  } else {
    assert(moduleStatus.review_status === 'draft', `${moduleStatus.id} review_status must be draft`)
    assert(moduleStatus.render_status === 'not_started', `${moduleStatus.id} render_status must be not_started`)
    assert(moduleStatus.privacy_status === 'needs_screen_review', `${moduleStatus.id} privacy_status must require screen review`)
  }
}

const module0Files = [
  'README.md',
  'primary-lesson-script.md',
  'heygen-segments.md',
  'elevenlabs-narration.md',
  'storyboard-render-spec.md',
  'render-handoff-checklist.md',
  'shorts-package.md',
  'thumbnail-briefs.md',
  'worksheet.md',
  'privacy-qa.md',
  'asset-manifest.json',
  path.join('captions', 'module-0-primary.srt'),
  path.join('visual-assets', 'title-card.svg'),
  path.join('visual-assets', 'closing-card.svg'),
]

for (const file of module0Files) {
  assert(fs.existsSync(path.join(module0AssetDir, file)), `Module 0 asset missing: ${file}`)
}

assert(module0Manifest.module_id === 'module-0', 'Module 0 manifest must identify module-0')
assert(module0Manifest.asset_packet_status === 'approved_for_render_preflight', 'Module 0 manifest must be approved for render preflight')
assert(module0Manifest.provider_execution_status === 'locked_until_explicit_approval', 'Module 0 provider execution must stay locked')
assert(module0Manifest.target_outputs?.primary_lesson, 'Module 0 manifest missing primary lesson output')
assert(module0Manifest.target_outputs?.youtube_short, 'Module 0 manifest missing YouTube Shorts output')
assert(module0Manifest.target_outputs?.thumbnail, 'Module 0 manifest missing thumbnail output')
assert(module0Manifest.provider_assets?.render_handoff_checklist === 'render-handoff-checklist.md', 'Module 0 manifest missing render handoff checklist')
assert(module0Manifest.safety?.allowed_now?.includes('video_generation_workflow_handoff_planning'), 'Module 0 must allow handoff planning without execution')
assert(module0Manifest.safety?.privacy_review_required_before_render === true, 'Module 0 must require privacy review before render')
for (const blocked of ['heygen_generation', 'elevenlabs_generation', 'final_render', 'upload', 'schedule', 'publish']) {
  assert(module0Manifest.safety?.blocked_until_separate_approval?.includes(blocked), `Module 0 manifest must block ${blocked}`)
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

console.log('Accelerated course module package validated: 8 modules plus approved Module 0 video asset packet and safety gates present.')
