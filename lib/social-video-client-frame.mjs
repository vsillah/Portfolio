const INTERNAL_FRAME_MARKERS = [
  /provider[- ]free/i,
  /local render/i,
  /motion\s*\/\s*shot direction/i,
  /\b(?:shot|scene)\s+\d+\b/i,
  /\b(?:short|long)-(?:hook|process|close|traceability|value|[a-z-]+)\b/i,
  /sha256:/i,
  /\binput version\b/i,
  /\breceipt[-_:][a-z0-9]/i,
  /\bsource:[a-z0-9]/i,
  /\.(?:png|jpe?g|json)\b/i,
  /no media provider/i,
  /\bno (?:upload|platform draft|publish)\b/i,
  /artifact_video_adaptation/i,
  /youtube_shorts/i,
  /render_gate/i,
  /explicit_approval_required/i,
  /provider_generation/i,
  /external_calls/i,
]

export const SOCIAL_VIDEO_INTERNAL_FRAME_MARKERS = INTERNAL_FRAME_MARKERS

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrap(value, width, maxLines) {
  const words = String(value).trim().split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= width) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = word
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (words.length && lines.join(' ').length < words.join(' ').length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/[.,;:]?$/, '')}…`
  }
  return lines.slice(0, maxLines)
}

function textBlock(lines, { x, y, size, color, weight = 400, lineHeight = 1.28 }) {
  return lines.map((line, index) => (
    `<text x="${x}" y="${y + index * size * lineHeight}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}">${escapeXml(line)}</text>`
  )).join('\n')
}

export function assertSocialVideoClientFacingText(values) {
  const joined = values.map((value) => String(value ?? '')).join('\n')
  const marker = INTERNAL_FRAME_MARKERS.find((pattern) => pattern.test(joined))
  if (marker) throw new Error(`Customer-facing video text contains an internal QA marker: ${marker.source}`)
}

export function buildSocialVideoClientFrameSvg({ title, onScreenText, narration, progress, total }) {
  assertSocialVideoClientFacingText([title, onScreenText, narration])
  const safeProgress = Math.max(1, Math.min(Number(progress) || 1, Number(total) || 1))
  const safeTotal = Math.max(safeProgress, Number(total) || 1)
  const progressWidth = 580 / safeTotal
  const progressRects = Array.from({ length: safeTotal }, (_, index) => (
    `<rect x="${1248 + index * progressWidth}" y="866" width="${Math.max(6, progressWidth - 8)}" height="8" rx="4" fill="${index < safeProgress ? '#f5c518' : '#314861'}"/>`
  )).join('\n')

  return `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#081525"/>
      <rect x="0" y="0" width="1920" height="108" fill="#172a43"/>
      ${textBlock(['AMADUTOWN ADVISORY SOLUTIONS'], { x: 116, y: 42, size: 18, color: '#f5c518', weight: 700 })}
      ${textBlock(wrap(title, 72, 1), { x: 116, y: 82, size: 29, color: '#f7f9fc', weight: 700 })}
      <rect x="36" y="136" width="1168" height="790" rx="20" fill="#0d1c2f" stroke="#49617d" stroke-width="2"/>
      <rect x="52" y="152" width="1136" height="758" rx="12" fill="#081525"/>
      <rect x="1228" y="136" width="656" height="790" rx="20" fill="#0d1c2f" stroke="#49617d" stroke-width="2"/>
      ${textBlock(wrap(onScreenText, 34, 4), { x: 1260, y: 226, size: 38, color: '#f5c518', weight: 700, lineHeight: 1.18 })}
      <rect x="1260" y="392" width="72" height="5" rx="2" fill="#7ee0c3"/>
      ${textBlock(wrap(narration, 46, 10), { x: 1260, y: 454, size: 25, color: '#d9e4f0', lineHeight: 1.38 })}
      ${progressRects}
      <rect x="36" y="958" width="1848" height="82" rx="16" fill="#172a43"/>
      ${textBlock(['AmaduTown Advisory Solutions'], { x: 64, y: 1008, size: 22, color: '#f7f9fc', weight: 700 })}
    </svg>
  `
}
