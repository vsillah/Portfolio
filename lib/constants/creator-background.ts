/**
 * Creator background for video idea generation.
 * Extracted from CLAUDE.md / AmaduTown context.
 * Update this file when brand or creator context changes.
 */

export const CREATOR_BACKGROUND = {
  name: 'Vambah Sillah',
  alias: 'Mad Hadda',
  role: 'Founder of AmaduTown Advisory Solutions',
  mission: 'Technology as the great equalizer for minority-owned businesses.',
  currentProject: 'Building the AmaduTown website + YouTube content production pipeline.',
  brand: {
    tone: 'Conversational, mission-driven, no-BS',
    signOff: "Let's get it",
  },
} as const

/** Plain-text summary for LLM prompt injection */
export function getCreatorBackgroundText(): string {
  return `Creator: ${CREATOR_BACKGROUND.name} (${CREATOR_BACKGROUND.alias}). ${CREATOR_BACKGROUND.role}. Mission: ${CREATOR_BACKGROUND.mission} Current project: ${CREATOR_BACKGROUND.currentProject}. Brand tone: ${CREATOR_BACKGROUND.brand.tone}. Sign-off: ${CREATOR_BACKGROUND.brand.signOff}.`
}
