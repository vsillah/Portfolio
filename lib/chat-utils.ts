/**
 * Client-safe chat utilities
 */

/**
 * Generate a unique session ID for chat sessions
 */
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `chat_${timestamp}_${randomPart}`
}

/**
 * Storage key for chat session
 */
export const CHAT_STORAGE_KEY = 'portfolio_chat_session'
