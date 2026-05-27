export const VIDEO_RENDER_APPROVAL_PACKET_PATH = 'docs/agentic-content-video-scripts/render-approval-packet.md'
export const VIDEO_RENDER_APPROVAL_SCOPE = 'internal_review_render_only'

export interface VideoRenderApproval {
  confirmed: boolean
  approvedBy: string
  packetPath: string
  scope: string
  publishingApproved?: boolean
}

export function buildVideoRenderApproval(confirmed: boolean): VideoRenderApproval {
  return {
    confirmed,
    approvedBy: 'Shaka',
    packetPath: VIDEO_RENDER_APPROVAL_PACKET_PATH,
    scope: VIDEO_RENDER_APPROVAL_SCOPE,
    publishingApproved: false,
  }
}

export function parseVideoRenderApproval(input: unknown): VideoRenderApproval | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const record = input as Record<string, unknown>
  return {
    confirmed: record.confirmed === true,
    approvedBy: typeof record.approvedBy === 'string' ? record.approvedBy.trim() : '',
    packetPath: typeof record.packetPath === 'string' ? record.packetPath.trim() : '',
    scope: typeof record.scope === 'string' ? record.scope.trim() : '',
    publishingApproved: record.publishingApproved === true,
  }
}

export function videoRenderApprovalError(input: unknown): string | null {
  const approval = parseVideoRenderApproval(input)
  if (!approval?.confirmed) {
    return 'Render approval confirmation is required before starting HeyGen.'
  }
  if (approval.approvedBy !== 'Shaka') {
    return 'Render approval must be confirmed as Shaka-approved.'
  }
  if (approval.packetPath !== VIDEO_RENDER_APPROVAL_PACKET_PATH) {
    return `Render approval must reference ${VIDEO_RENDER_APPROVAL_PACKET_PATH}.`
  }
  if (approval.scope !== VIDEO_RENDER_APPROVAL_SCOPE) {
    return `Render approval scope must be ${VIDEO_RENDER_APPROVAL_SCOPE}.`
  }
  if (approval.publishingApproved) {
    return 'Publishing approval cannot be bundled with the render approval.'
  }
  return null
}
