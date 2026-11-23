import { AGENTIFIED_SHARE_TEXT, AGENTIFIED_SHARE_URL, AGENTIFIED_X_TEXT } from '@/components/member/agentified-certificate-share'

export type CertificateShareConfig = {
  title: string
  publicUrl: `https://amadutown.com/${string}`
  achievementText: string
  xText: string
  invitation: string
  linkLabel: string
}

export const certificateShare = {
  accelerated: {
    title: 'Accelerated course completion',
    publicUrl: 'https://amadutown.com/accelerated',
    achievementText: 'I completed AmaduTown’s Accelerated course. The lessons cover how to frame a product decision, test the evidence, and use a Decision File to keep people aligned. Explore the course:',
    xText: 'I completed AmaduTown’s Accelerated course. The lessons show how to frame a product decision and test evidence before moving forward. Explore the course:',
    invitation: 'Invite someone to work through a product decision with evidence and a practical Decision File.',
    linkLabel: 'course link',
  },
  agentified: {
    title: 'Agentified workshop completion',
    publicUrl: AGENTIFIED_SHARE_URL,
    achievementText: AGENTIFIED_SHARE_TEXT,
    xText: AGENTIFIED_X_TEXT,
    invitation: 'Invite someone to learn how to build governed agent systems.',
    linkLabel: 'workshop link',
  },
} as const satisfies Record<string, CertificateShareConfig>

export type CertificateShareCourse = keyof typeof certificateShare

export function certificateSharePayload(config: CertificateShareConfig) {
  const url = new URL(config.publicUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'amadutown.com' || url.search || url.hash || !url.pathname || url.pathname === '/') throw new Error('Certificate share requires a public course page')
  if (![config.title, config.achievementText, config.xText, config.invitation, config.linkLabel].every((value) => value.trim())) throw new Error('Certificate share copy is incomplete')
  const message = `${config.achievementText} ${config.publicUrl}`
  const links = {
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(config.publicUrl)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(config.publicUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(config.xText)}&url=${encodeURIComponent(config.publicUrl)}`,
  }
  return { message, links }
}
