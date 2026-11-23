export const AGENTIFIED_SHARE_URL = 'https://amadutown.com/agentified'

export const AGENTIFIED_SHARE_TEXT = 'I completed AmaduTown’s Agentified workshop. I can now design governed agent operating systems with clear roles, human approval gates, traceable handoffs, and rollback paths. If you’re building with AI, this workshop gives you a practical operating file to do it responsibly:'

export const AGENTIFIED_SHARE_MESSAGE = `${AGENTIFIED_SHARE_TEXT} ${AGENTIFIED_SHARE_URL}`

export const AGENTIFIED_X_TEXT = 'I completed AmaduTown’s Agentified workshop. I can design governed agent systems with clear roles, human approval gates, traceable handoffs, and rollback paths. Build your own operating file:'

export const AGENTIFIED_SHARE_LINKS = {
  linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(AGENTIFIED_SHARE_URL)}`,
  facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(AGENTIFIED_SHARE_URL)}`,
  x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(AGENTIFIED_X_TEXT)}&url=${encodeURIComponent(AGENTIFIED_SHARE_URL)}`,
} as const
