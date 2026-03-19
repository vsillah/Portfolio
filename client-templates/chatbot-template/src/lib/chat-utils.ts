/**
 * Client-safe chat utilities
 */

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 15)
  return `chat_${timestamp}_${randomPart}`
}

export const CHAT_STORAGE_KEY = 'chat_session_id'
