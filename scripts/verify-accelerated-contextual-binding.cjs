const { createHash } = require('node:crypto')
const { readFileSync, statSync } = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const digest = (file) => createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')
const seconds = (clock) => clock.split(':').map(Number).reduce((value, part) => value * 60 + part, 0)
const assert = (condition, reason) => { if (!condition) throw new Error(`Accelerated contextual binding: ${reason}`) }

function verifyAcceleratedContextualBinding(options = {}) {
  const technicalPath = 'docs/accelerated-course-modules/l09-l16-contextual-binding/technical-receipt.json'
  const bindingPath = 'lib/accelerated-contextual-bindings.json'
  const approvalPath = 'docs/accelerated-course-modules/l09-l16-contextual-binding/human-qa-receipt.json'
  const l12DeltaPath = 'docs/accelerated-course-modules/l09-l16-contextual-binding/l12-momentum-binding-2cd29b4b1aae.json'
  const technical = options.technical ?? JSON.parse(readFileSync(path.join(root, technicalPath)))
  const binding = options.binding ?? JSON.parse(readFileSync(path.join(root, bindingPath)))
  const approval = options.approval ?? JSON.parse(readFileSync(path.join(root, approvalPath)))
  const l12Delta = JSON.parse(readFileSync(path.join(root, l12DeltaPath)))
  const sourceReview = '7327975f1cc5922da3bd004f7b1af9b797f57005b6a220e4167da0f51aa97fdf'
  assert(binding.status === 'human_qa_pending' && approval.status === 'human_qa_pending' && approval.full_lesson_human_qa_claimed === false && approval.external_actions_authorized === false, 'review status changed')
  assert(binding.approved_excerpt_receipt_sha256 === sourceReview && approval.source_excerpt_receipt_sha256 === sourceReview && technical.review_sha256.receipt === sourceReview, 'source review drifted')
  assert(binding.technical_receipt_sha256 === digest(technicalPath), 'technical receipt drifted')
  assert(digest(l12DeltaPath).startsWith('2cd29b4b1aae') && l12Delta.schema === 'accelerated_l12_momentum_binding_delta_v1', 'L12 delta receipt drifted')
  assert(approval.candidate_binding_sha256 === l12Delta.historical_candidate_binding_sha256 &&
    l12Delta.current_binding_sha256 === digest(bindingPath), 'candidate approval or L12 delta binding drifted')
  assert(l12Delta.caption.sha256 === digest(`public${l12Delta.caption.path}`) &&
    l12Delta.timing.duration_seconds === binding.lessons.L12.duration_seconds &&
    l12Delta.audio.aac_stream_sha256 === '60fa992c5d4a6fc134c8ab7599ecf160756523717ea7b08e434052e383092a23', 'L12 preserved caption, timing, or audio receipt drifted')
  const ids = Array.from({ length: 8 }, (_, index) => `L${String(index + 9).padStart(2, '0')}`)
  const samScenes = { L11: ['L11-03'], L12: ['L12-01'], L16: ['L16-01', 'L16-06'] }
  const canonicalSam = 'agentified/manuscript/visuals/rendered/print/color-600dpi/figure-0-0-accelerated-sam-loop-print-600dpi.png'
  const canonicalSamHash = 'b7ab226d17f5ae4b421936b0ea541646223f55c0121da328e483941175c39ea3'
  assert(digest(canonicalSam) === canonicalSamHash, 'canonical SAM source drifted')
  assert(JSON.stringify(Object.keys(binding.lessons)) === JSON.stringify(ids), 'lesson set changed')
  for (const id of ids) {
    const item = binding.lessons[id]
    const proof = technical.lessons[id]
    assert(proof && Math.abs(item.duration_seconds - proof.duration_seconds) < .001, `${id} duration changed`)
    if (samScenes[id]) {
      const correction = proof.sam_framework_correction
      assert(JSON.stringify(correction?.scene_ids) === JSON.stringify(samScenes[id]), `${id} SAM scene list changed`)
      assert(correction.canonical_source_path === canonicalSam && correction.canonical_source_sha256 === canonicalSamHash, `${id} SAM source changed`)
    }
    assert(Math.abs(item.final_caption_end_seconds - item.duration_seconds) < .02, `${id} final cue time changed`)
    assert(item.caption.path === proof.caption.path && item.caption.sha256 === proof.caption.sha256, `${id} caption binding changed`)
    assert(item.caption.sha256 === digest(`public${item.caption.path}`), `${id} caption drifted`)
    assert(item.transcript.source_vtt_sha256 === item.caption.sha256, `${id} transcript source changed`)
    const cueBlocks = readFileSync(path.join(root, `public${item.caption.path}`), 'utf8').trim().split(/\n\s*\n/)
    const cues = cueBlocks.flatMap((block) => {
      const lines = block.split('\n')
      const timing = lines.findIndex((line) => line.includes(' --> '))
      if (timing < 0) return []
      const [start, end] = lines[timing].split(' --> ')
      return [{ start, end, text: lines.slice(timing + 1).join(' ').trim() }]
    })
    assert(JSON.stringify(cues) === JSON.stringify(item.transcript.cues), `${id} transcript changed`)
    const last = cues.at(-1)
    assert(last && last.text === item.final_caption_text && Math.abs(seconds(last.end) - item.final_caption_end_seconds) < .001, `${id} final caption changed`)
    for (const variant of ['desktop', 'portrait']) {
      const media = item.variants[variant]
      const receipt = proof.variants[variant]
      const delta = id === 'L12' ? l12Delta.media[variant] : null
      assert(delta ? media.path === delta.path && media.sha256 === delta.sha256 &&
        receipt.sha256 === delta.source_sha256 : media.path === receipt.path && media.sha256 === receipt.sha256, `${id} ${variant} media binding changed`)
      assert(media.path.includes(`/${id.toLowerCase()}/contextual-${media.sha256.slice(0, 12)}/`), `${id} ${variant} path is not immutable`)
      assert(media.sha256 === digest(`public${media.path}`), `${id} ${variant} media drifted`)
      assert(statSync(path.join(root, `public${media.path}`)).size === (delta?.bytes ?? receipt.bytes_after), `${id} ${variant} media size changed`)
      assert((delta ? l12Delta.timing.video_frames === 11511 && l12Delta.timing.max_frame_pts_drift_seconds === 0 : receipt.ssim >= .995) &&
        Math.abs(receipt.duration_seconds - item.duration_seconds) < .02, `${id} ${variant} encode gate failed`)
      assert(receipt.audio_stream_hash === proof.variants.desktop.audio_stream_hash, `${id} audio variants differ`)
      if (id === 'L12' && variant === 'portrait') {
        const correction = receipt.text_correction
        assert(correction?.source_wording === 'Source ID → context → job → question', 'L12 correction wording changed')
        assert(correction.start_seconds === 86.04 && correction.end_seconds === 147.56, 'L12 correction window changed')
        assert(correction.overlay_sha256 === digest(correction.overlay_path), 'L12 correction overlay drifted')
      }
    }
  }
  return true
}

module.exports = { verifyAcceleratedContextualBinding }
if (require.main === module) verifyAcceleratedContextualBinding()
