/**
 * Video format and channel constants for HeyGen pipeline.
 * aspect_ratio matches HeyGen API: "16:9" | "9:16"
 * channel is metadata for targeting (YouTube, YouTube Shorts, LinkedIn).
 */

export const VIDEO_ASPECT_RATIOS = ['16:9', '9:16'] as const
export type VideoAspectRatio = (typeof VIDEO_ASPECT_RATIOS)[number]

export const VIDEO_CHANNELS = ['youtube', 'youtube_shorts', 'linkedin', 'linkedin_video'] as const
export type VideoChannel = (typeof VIDEO_CHANNELS)[number]

export interface VideoChannelConfig {
  id: VideoChannel
  label: string
  defaultAspectRatio: VideoAspectRatio
  typicalLengthSec: { min: number; max: number }
}

export const VIDEO_CHANNEL_CONFIGS: Record<VideoChannel, VideoChannelConfig> = {
  youtube: {
    id: 'youtube',
    label: 'YouTube',
    defaultAspectRatio: '16:9',
    typicalLengthSec: { min: 60, max: 600 },
  },
  youtube_shorts: {
    id: 'youtube_shorts',
    label: 'YouTube Shorts',
    defaultAspectRatio: '9:16',
    typicalLengthSec: { min: 15, max: 60 },
  },
  linkedin: {
    id: 'linkedin',
    label: 'LinkedIn',
    defaultAspectRatio: '16:9',
    typicalLengthSec: { min: 30, max: 90 },
  },
  linkedin_video: {
    id: 'linkedin_video',
    label: 'LinkedIn Video (vertical)',
    defaultAspectRatio: '9:16',
    typicalLengthSec: { min: 30, max: 90 },
  },
}

/** Map channel to default aspect ratio for HeyGen API */
export function channelToAspectRatio(channel: VideoChannel): VideoAspectRatio {
  return VIDEO_CHANNEL_CONFIGS[channel].defaultAspectRatio
}
