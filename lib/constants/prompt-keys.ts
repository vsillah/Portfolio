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
  'video_prompt_formatter',
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome',
] as const

export type PromptKey = (typeof PROMPT_KEYS)[number]

/** Display name for each prompt key – use in UI (cards, links, filters). */
export const PROMPT_DISPLAY_NAMES: Record<string, string> = {
  chatbot: 'Portfolio Chatbot',
  voice_agent: 'Voice Agent',
  llm_judge: 'LLM Judge',
  diagnostic: 'Diagnostic',
  client_email_reply: 'Client Email Reply',
  video_prompt_formatter: 'Video Prompt Formatter',
  email_cold_outreach: 'Cold Outreach Email',
  email_asset_delivery: 'Asset Delivery Email',
  email_follow_up: 'Follow-Up Email',
  email_proposal_delivery: 'Proposal Delivery Email',
  email_onboarding_welcome: 'Onboarding Welcome Email',
}

/** Subset of prompt keys that are Saraev email templates, for the compose panel dropdown. */
export const EMAIL_TEMPLATE_KEYS = [
  'email_cold_outreach',
  'email_asset_delivery',
  'email_follow_up',
  'email_proposal_delivery',
  'email_onboarding_welcome',
] as const

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number]

export function getPromptDisplayName(key: string): string {
  return PROMPT_DISPLAY_NAMES[key] ?? key
}
