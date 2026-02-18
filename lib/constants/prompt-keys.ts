/**
 * Canonical prompt keys and display names used across admin, chat eval, and diagnoses.
 * Use these everywhere so naming is consistent (System Prompts page, Error Diagnoses, queues, etc.).
 */

export const PROMPT_KEYS = [
  'chatbot',
  'voice_agent',
  'llm_judge',
  'diagnostic',
  'client_email_reply',
] as const

export type PromptKey = (typeof PROMPT_KEYS)[number]

/** Display name for each prompt key – use in UI (cards, links, filters). */
export const PROMPT_DISPLAY_NAMES: Record<string, string> = {
  chatbot: 'Portfolio Chatbot',
  voice_agent: 'Voice Agent',
  llm_judge: 'LLM Judge',
  diagnostic: 'Diagnostic',
  client_email_reply: 'Client Email Reply',
}

export function getPromptDisplayName(key: string): string {
  return PROMPT_DISPLAY_NAMES[key] ?? key
}
