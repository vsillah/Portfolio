export const VIDEO_RENDER_SCRIPT_MAX = 5000

export interface VideoRenderReadinessInput {
  title: string | null
  status: string | null
  scriptText: string | null
  storyboardScenes: number
  videoGenerationJobId: string | null
  templateId: string | null
  avatarId: string | null
  voiceId: string | null
  channel: string
  aspectRatio: string
  brollAssetIds: string[]
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
  }
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
    },
  }
}
