/**
 * Feature Flags Configuration
 *
 * Toggle features on/off without changing code.
 * This file is YOUR territory — updates from the template will never overwrite it.
 */

const features = {
  /** Enable voice chat via VAPI (requires VAPI env vars) */
  voiceChat: true,

  /** Persist chat history in Supabase */
  chatHistory: true,

  /** Show suggested quick-action buttons on first load */
  suggestedActions: true,

  /** Enable cross-channel context (share history between text and voice) */
  crossChannelContext: true,

  /** Show typing indicator while waiting for AI response */
  typingIndicator: true,

  /** Allow users to clear their chat history */
  clearChat: true,
} as const

export default features
