// Defense in depth for synthetic/reviewed-redacted input. This is not a complete
// PII detector and does not authorize sending production or private records.
const replacements: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[private email redacted]'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, '[private identifier redacted]'],
  [/(?<!\w)\+?\d[\d ().-]{7,}\d(?!\w)/g, '[private number redacted]'],
  [/https?:\/\/[^\s]+/gi, '[link redacted]'],
  [/(^|\s)@[\w.-]+/g, '$1[private handle redacted]'],
]

export function minimizeShadowText(text: string) {
  let minimized = text
  for (const [pattern, replacement] of replacements) minimized = minimized.replace(pattern, replacement)
  return { text: minimized, redacted: minimized !== text || /\[(?:private .+|link) redacted\]/i.test(text) }
}

// Suspected credentials are rejected before transport, never logged or returned.
export function hasCredentialLikeText(text: string) {
  return /\b(?:bearer\s+\S+|(?:api[_ -]?key|password|secret|access[_ -]?token)\s*[:=]\s*\S+|(?:sk|ghp|gho)[_-][A-Za-z0-9_-]{8,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/i.test(text)
}
