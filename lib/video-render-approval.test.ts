import { describe, expect, it } from 'vitest'
import {
  buildVideoRenderApproval,
  VIDEO_RENDER_APPROVAL_PACKET_PATH,
  VIDEO_RENDER_APPROVAL_SCOPE,
  videoRenderApprovalError,
} from './video-render-approval'

describe('video render approval', () => {
  it('accepts the controlled internal render approval payload', () => {
    expect(videoRenderApprovalError(buildVideoRenderApproval(true))).toBeNull()
  })

  it('rejects missing confirmation', () => {
    expect(videoRenderApprovalError(buildVideoRenderApproval(false))).toContain('required')
  })

  it('rejects bundled publishing approval', () => {
    expect(videoRenderApprovalError({
      confirmed: true,
      approvedBy: 'Shaka',
      packetPath: VIDEO_RENDER_APPROVAL_PACKET_PATH,
      scope: VIDEO_RENDER_APPROVAL_SCOPE,
      publishingApproved: true,
    })).toContain('Publishing approval')
  })
})
