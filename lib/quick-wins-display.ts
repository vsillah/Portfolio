/**
 * Normalize contact_submissions.quick_wins for display and downstream text use.
 * DB jsonb may be plain text, an array of strings/objects, or (legacy) malformed strings with "• undefined".
 */

/** Remove lines that are only undefined placeholders (bad meeting imports / API shapes). */
export function sanitizeQuickWinsString(s: string): string {
  return s
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (t === 'undefined' || /^[•\-*]\s*undefined\s*$/u.test(t)) return false
      return true
    })
    .join('\n')
    .trim()
}

function lineFromObjectItem(item: Record<string, unknown>): string {
  const t =
    item.text ??
    item.action ??
    item.title ??
    item.description ??
    item.body ??
    item.win ??
    item.summary
  return typeof t === 'string' ? t.trim() : ''
}

/**
 * Plain-text block suitable for UI (whitespace-pre-wrap) or markdown sections.
 * Returns null when there is nothing meaningful to show.
 */
export function formatQuickWinsForDisplay(value: unknown): string | null {
  if (value == null) return null

  if (typeof value === 'string') {
    const s = sanitizeQuickWinsString(value)
    return s.length ? s : null
  }

  if (Array.isArray(value)) {
    const lines = value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object') return lineFromObjectItem(item as Record<string, unknown>)
        return ''
      })
      .filter((s) => s.length > 0 && s !== 'undefined')
    if (!lines.length) return null
    return lines.map((l) => (l.startsWith('•') ? l : `• ${l}`)).join('\n')
  }

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>
    if (Array.isArray(o.items)) return formatQuickWinsForDisplay(o.items)
    if (typeof o.quick_wins === 'string') return formatQuickWinsForDisplay(o.quick_wins)
    if (typeof o.text === 'string') return formatQuickWinsForDisplay(o.text)
    const single = lineFromObjectItem(o)
    if (single && single !== 'undefined') return single
  }

  return null
}

/** Controlled textarea / PATCH payload: always a string, never "[object Object]". */
export function quickWinsToEditableString(value: unknown): string {
  const d = formatQuickWinsForDisplay(value)
  if (d != null) return d
  if (typeof value === 'string') return sanitizeQuickWinsString(value)
  return ''
}

/**
 * Non-empty phrases for email fallbacks (split on newlines / semicolons; strip bullet prefixes).
 */
export function quickWinsToLines(value: unknown, max = 20): string[] {
  const text =
    formatQuickWinsForDisplay(value) ??
    (typeof value === 'string' ? sanitizeQuickWinsString(value) : '')
  if (!text) return []
  return text
    .split(/[;\n]+/)
    .map((w) => w.replace(/^[•\-*]\s*/, '').trim())
    .filter((w) => w.length > 0 && w !== 'undefined')
    .slice(0, max)
}
