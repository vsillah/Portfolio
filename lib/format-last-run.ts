/** Relative time label for “last run” style UI (matches admin video-generation Drive sync). */
export function formatLastRunLabel(date: Date | null): string | null {
  if (!date) return null
  const diff = Date.now() - date.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
