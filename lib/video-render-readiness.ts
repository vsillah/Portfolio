import { evaluateVideoScript, type VideoScriptScorecard, type VideoScriptTemplateOutline } from './video-script-intelligence'
import type { LongFormScriptReview } from './long-form-script-intelligence'

export const VIDEO_RENDER_SCRIPT_MAX = 5000

export interface VideoRenderReadinessInput {
  title: string | null
  status: string | null
  scriptText: string | null
  scriptOutline?: Partial<VideoScriptTemplateOutline> | null
  scriptScorecard?: VideoScriptScorecard | null
  researchPacketIds?: string[]
  storyboardScenes: number
  videoGenerationJobId: string | null
  templateId: string | null
  avatarId: string | null
  voiceId: string | null
  channel: string
  aspectRatio: string
  brollAssetIds: string[]
  longFormScriptReview?: LongFormScriptReview | null
}

export interface VideoRenderReadinessReport {
  ready: boolean
  blockingIssues: string[]
  warnings: string[]
  details: {
    title: string
    scriptCharacters: number
    storyboardScenes: number
    brollAssetIds: string[]
    heygenMode: 'template' | 'avatar_voice' | 'missing'
    templateId: string | null
    avatarId: string | null
    voiceId: string | null
    channel: string
    aspectRatio: string
    approvalBoundary: string
    scriptScorecard: VideoScriptScorecard
    longFormScriptReview: LongFormScriptReview | null
  }
}

function isCurrentScriptScorecard(value: VideoScriptScorecard | null | undefined): value is VideoScriptScorecard {
  return Boolean(value && Array.isArray(value.blockers) && Array.isArray(value.warnings))
}

export function buildVideoRenderReadinessReport(input: VideoRenderReadinessInput): VideoRenderReadinessReport {
  const blockingIssues: string[] = []
  const warnings: string[] = []
  const scriptText = (input.scriptText ?? '').trim()
  const title = (input.title ?? '').trim() || 'Untitled draft'
  const hasTemplate = Boolean(input.templateId)
  const hasAvatarVoice = Boolean(input.avatarId && input.voiceId)
  const heygenMode = hasTemplate ? 'template' : hasAvatarVoice ? 'avatar_voice' : 'missing'

  if (input.status !== 'pending') {
    blockingIssues.push(`Draft must be pending before render. Current status: ${input.status ?? 'unknown'}.`)
  }
  if (input.videoGenerationJobId) {
    blockingIssues.push('Draft already has a video generation job linked.')
  }
  if (!scriptText) {
    blockingIssues.push('Draft has no script text.')
  }
  if (scriptText.length > VIDEO_RENDER_SCRIPT_MAX) {
    blockingIssues.push(`Script exceeds HeyGen limit of ${VIDEO_RENDER_SCRIPT_MAX.toLocaleString()} characters (${scriptText.length.toLocaleString()}).`)
  }
  if (!hasTemplate && !hasAvatarVoice) {
    blockingIssues.push('HeyGen template or avatar and voice must be configured before render.')
  }

  const scriptScorecard = isCurrentScriptScorecard(input.scriptScorecard) ? input.scriptScorecard : evaluateVideoScript({
    scriptText,
    outline: input.scriptOutline,
    researchPacketCount: input.researchPacketIds?.length ?? 0,
  })
  blockingIssues.push(...scriptScorecard.blockers)
  warnings.push(...scriptScorecard.warnings)

  const longFormScriptReview = input.longFormScriptReview ?? null
  if (input.channel === 'youtube' && !longFormScriptReview?.approval_ready) {
    const reason = longFormScriptReview?.blockers[0]
      ?? 'A current long-form script intelligence receipt is required.'
    blockingIssues.push(`Long-form script intelligence blocked render readiness: ${reason}`)
  }

  if (input.storyboardScenes === 0) {
    warnings.push('No storyboard scenes are attached for visual direction.')
  }
  if (input.brollAssetIds.length === 0) {
    warnings.push('No B-roll assets are linked or matched for this draft.')
  }
  if (!hasTemplate && hasAvatarVoice) {
    warnings.push('Render will use direct avatar and voice settings instead of a HeyGen template.')
  }

  return {
    ready: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    details: {
      title,
      scriptCharacters: scriptText.length,
      storyboardScenes: input.storyboardScenes,
      brollAssetIds: input.brollAssetIds,
      heygenMode,
      templateId: input.templateId,
      avatarId: input.avatarId,
      voiceId: input.voiceId,
      channel: input.channel,
      aspectRatio: input.aspectRatio,
      approvalBoundary: 'Readiness does not start a render. Shaka render approval is still required before HeyGen is called.',
      scriptScorecard,
      longFormScriptReview,
    },
  }
}
