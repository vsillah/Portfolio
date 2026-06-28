import fs from 'node:fs'
import path from 'node:path'
import {
  evaluateVideoScript,
  SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
  SEEDED_VIDEO_SCRIPT_TEMPLATES,
  type VideoScriptScorecard,
  type VideoScriptTemplate,
  type VideoScriptTemplateOutline,
} from './video-script-intelligence'

export const ACCELERATED_MODULE0_DRAFT_MARKER = 'course_packet:accelerated-module-0:script_intelligence_review_ready'

export const ACCELERATED_MODULE0_PACKET_DIR = 'docs/accelerated-course-modules/module-0-video-assets'

export type AcceleratedModule0VideoDraft = {
  title: string
  script_text: string
  storyboard_json: {
    source_packet: {
      module: string
      script_path: string
      storyboard_path: string
      review_path: string
      marker: string
    }
    scenes: Array<{
      sceneNumber: number
      title: string
      duration: string
      description: string
      brollHint: string
    }>
    safety: {
      provider_execution: 'locked_until_explicit_approval'
      external_side_effects: typeof SCRIPT_INTELLIGENCE_SIDE_EFFECTS
      privacy_review_required: true
    }
  }
  source: 'manual'
  status: 'pending'
  custom_prompt: string
  script_outline: VideoScriptTemplateOutline
  script_scorecard: VideoScriptScorecard
  research_packet_ids: string[]
}

function readPacketFile(relativeFile: string) {
  return fs.readFileSync(path.join(process.cwd(), ACCELERATED_MODULE0_PACKET_DIR, relativeFile), 'utf8')
}

function extractSection(markdown: string, heading: string, nextHeadingPrefix = '## ') {
  const start = markdown.indexOf(heading)
  if (start === -1) return markdown.trim()

  const contentStart = start + heading.length
  const nextStart = markdown.indexOf(nextHeadingPrefix, contentStart)
  return markdown
    .slice(contentStart, nextStart === -1 ? undefined : nextStart)
    .trim()
}

export function getAcceleratedModule0Template(): VideoScriptTemplate {
  return SEEDED_VIDEO_SCRIPT_TEMPLATES.find((template) => template.key === 'accelerated_lesson')
    ?? SEEDED_VIDEO_SCRIPT_TEMPLATES[0]
}

export function buildAcceleratedModule0ScriptOutline(): VideoScriptTemplateOutline {
  return {
    pain_point: 'AI can make polished artifacts before the team has clarified judgment, evidence, risk, and next action.',
    hook: 'A generated lesson preview looked realistic and well-paced, but the content did not make the pain or CTA clear.',
    open_loop: 'If production quality is no longer the blocker, what keeps the work trustworthy?',
    frame: 'The blank page is gone; judgment is the bottleneck.',
    proof_demo: 'AmaduTown/Portfolio operating layer: diagnostics, evidence dashboards, social content review gates, agent work queues, script scorecards, b-roll planning, privacy checks, and render-readiness approvals.',
    teaching_beats: [
      'The speed trap: AI output can look finished before the thinking is finished.',
      'The decision-first frame: name the decision before polishing the artifact.',
      'The proof loop: connect signal, decision, workflow, and learning.',
    ],
    cta: 'Build one Accelerated loop, then join the Accelerated Workshop interest path or book an AI Quick Win discovery call through AmaduTown.',
    closing_question: 'What decision is this AI-generated artifact supposed to improve?',
    thumbnail_promise: 'The video looked ready. The script was not.',
    source_distance_notes: 'Internal AmaduTown/Portfolio proof only; no creator script, title, thumbnail, or visual identity copied.',
  }
}

export function buildAcceleratedModule0VideoDraft(): AcceleratedModule0VideoDraft {
  const primaryScript = readPacketFile('primary-lesson-script.md')
  const scriptText = extractSection(primaryScript, '## Script')
  const outline = buildAcceleratedModule0ScriptOutline()
  const template = getAcceleratedModule0Template()
  const scorecard = evaluateVideoScript({
    scriptText,
    outline,
    template,
    researchPacketCount: 0,
  })

  return {
    title: 'Accelerated Module 0: Why Accelerated Exists',
    script_text: scriptText,
    storyboard_json: {
      source_packet: {
        module: 'accelerated-module-0',
        script_path: `${ACCELERATED_MODULE0_PACKET_DIR}/primary-lesson-script.md`,
        storyboard_path: `${ACCELERATED_MODULE0_PACKET_DIR}/storyboard-render-spec.md`,
        review_path: `${ACCELERATED_MODULE0_PACKET_DIR}/script-intelligence-review.md`,
        marker: ACCELERATED_MODULE0_DRAFT_MARKER,
      },
      scenes: [
        {
          sceneNumber: 1,
          title: 'Cold Open',
          duration: '0:00-0:18',
          description: 'Open on the production-quality lesson preview problem: the video looked ready, but the script was not.',
          brollHint: 'Avatar clip placeholder or text-led cold open; provider execution locked.',
        },
        {
          sceneNumber: 2,
          title: 'Production Gap',
          duration: '0:30-1:25',
          description: 'Show the contrast between realistic cadence and missing pain/CTA clarity.',
          brollHint: 'Local text animation only until HeyGen/ElevenLabs approval.',
        },
        {
          sceneNumber: 3,
          title: 'Judgment Bottleneck',
          duration: '2:15-3:20',
          description: 'Frame the core lesson: AI removes the blank page, but judgment becomes the bottleneck.',
          brollHint: 'Framework card or sanitized course visual.',
        },
        {
          sceneNumber: 4,
          title: 'AmaduTown Proof',
          duration: '3:20-4:50',
          description: 'Use public-safe Portfolio and AmaduTown proof surfaces as the receipt.',
          brollHint: 'Public or redacted b-roll only; privacy review required before render.',
        },
        {
          sceneNumber: 5,
          title: 'The Accelerated Loop',
          duration: '6:15-7:35',
          description: 'Animate Signal -> Decision -> Loop -> Learning as the first practical exercise.',
          brollHint: 'Course-native framework animation.',
        },
        {
          sceneNumber: 6,
          title: 'CTA Close',
          duration: '7:35-8:35',
          description: 'Ask the learner to identify one workflow where AI output outruns review, then choose the workshop interest or AI Quick Win path.',
          brollHint: 'Closing card; upload and publishing locked.',
        },
      ],
      safety: {
        provider_execution: 'locked_until_explicit_approval',
        external_side_effects: SCRIPT_INTELLIGENCE_SIDE_EFFECTS,
        privacy_review_required: true,
      },
    },
    source: 'manual',
    status: 'pending',
    custom_prompt: ACCELERATED_MODULE0_DRAFT_MARKER,
    script_outline: outline,
    script_scorecard: scorecard,
    research_packet_ids: [],
  }
}
