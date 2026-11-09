export function normalizeCaptionText(value) {
  return value
    .toLowerCase()
    .replaceAll(/[’‘]/g, "'")
    .replaceAll(/[^a-z0-9']/g, ' ')
    .trim()
    .replaceAll(/\s+/g, ' ')
}

export function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+[”’"'`]*(?=\s|$)|[^.!?]+$/g) || [text])
    .map((value) => value.trim())
    .filter(Boolean)
}

export function expectedCaptionText(candidate) {
  return [
    candidate.presenter_passages[0].passage_exact,
    candidate.offscreen_narration.text,
    candidate.presenter_passages[1].passage_exact,
  ].join(' ')
}

export function assertCaptionMatches(actual, expected, label) {
  if (normalizeCaptionText(actual) !== normalizeCaptionText(expected)) {
    throw new Error(`${label} transcript drift`)
  }
  return true
}

export function extractSrtText(value) {
  return value
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').slice(2).join(' ').trim())
    .filter(Boolean)
    .join(' ')
}

export function extractVttText(value) {
  return value
    .replace(/^WEBVTT\s*/u, '')
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.split('\n').filter((line) => !line.includes('-->')).join(' ').trim())
    .filter(Boolean)
    .join(' ')
}
