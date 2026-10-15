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

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function ease(value) {
  const t = clamp(value)
  return t * t * (3 - (2 * t))
}

function sceneAlpha(seconds, start, end, fade = 0.35) {
  return clamp(Math.min((seconds - start) / fade, (end - seconds) / fade))
}

function motionText(value, { x, y, size, color = '#f7f9fc', weight = 700, anchor = 'start', opacity = 1 }) {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${opacity}">${escapeXml(value)}</text>`
}

function motionCard({ x, y, width, height, color = '#152a43', stroke = '#36516f', opacity = 1, radius = 30 }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${color}" stroke="${stroke}" stroke-width="2" opacity="${opacity}"/>`
}

export const JEV_MOTION_TIMELINE = [
  { id: 'hook', start: 0, end: 3.8, label: 'A score is not a decision' },
  { id: 'signal', start: 3.4, end: 7.5, label: 'Read the signal' },
  { id: 'policy', start: 7.1, end: 11.7, label: 'Apply the policy' },
  { id: 'ownership', start: 11.3, end: 15.9, label: 'Keep ownership visible' },
  { id: 'exception', start: 15.5, end: 19.6, label: 'Who owns the exception?' },
  { id: 'close', start: 19.2, end: 22, label: 'Make uncertainty visible' },
]

export function buildJevMotionFrameSvg({ frame, fps = 30, duration = 22 }) {
  const seconds = frame / fps
  const copy = [
    'A score is not a decision.',
    'Who owns the exception?',
    'Read the signal',
    'Apply the policy',
    'Keep ownership visible',
    'Make uncertainty visible enough to act on.',
    'Illustrative policy bands',
    'Route A',
    'Human review',
    'Refuse',
    'Model',
    'Policy layer',
    'Human owner',
    'Decision record',
  ]
  assertSocialVideoClientFacingText(copy)

  const progress = clamp(seconds / duration)
  const pulse = (Math.sin(seconds * Math.PI * 2) + 1) / 2
  const backgroundDots = Array.from({ length: 18 }, (_, index) => {
    const x = 70 + ((index * 157 + seconds * (8 + (index % 4) * 3)) % 940)
    const y = 150 + ((index * 263 + seconds * (5 + (index % 3) * 2)) % 1580)
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${2 + (index % 3)}" fill="#4ed7c0" opacity="${0.08 + (index % 4) * 0.025}"/>`
  }).join('')

  const hookAlpha = sceneAlpha(seconds, 0, 3.8)
  const hookEnter = ease(seconds / 0.9)
  const signalAlpha = sceneAlpha(seconds, 3.4, 7.5)
  const signalLocal = ease((seconds - 3.55) / 1.3)
  const policyAlpha = sceneAlpha(seconds, 7.1, 11.7)
  const policyLocal = ease((seconds - 7.3) / 1.7)
  const ownershipAlpha = sceneAlpha(seconds, 11.3, 15.9)
  const ownershipLocal = clamp((seconds - 11.5) / 3.2)
  const exceptionAlpha = sceneAlpha(seconds, 15.5, 19.6)
  const exceptionLocal = ease((seconds - 15.7) / 1.2)
  const closeAlpha = sceneAlpha(seconds, 19.2, 22, 0.28)
  const closeLocal = ease((seconds - 19.35) / 1)

  const probabilityCards = [
    { label: 'Route A', value: '0.81', amount: 0.81, color: '#55dbc8' },
    { label: 'Human review', value: '0.14', amount: 0.14, color: '#f5c84c' },
    { label: 'Refuse', value: '0.05', amount: 0.05, color: '#ff9378' },
  ].map((item, index) => {
    const itemProgress = ease((signalLocal * 1.25) - index * 0.18)
    const y = 575 + index * 270
    const slide = (1 - itemProgress) * 110
    return `
      <g transform="translate(${slide},0)" opacity="${itemProgress}">
        ${motionCard({ x: 105, y, width: 870, height: 210, color: '#10243b', stroke: item.color })}
        ${motionText(item.label, { x: 155, y: y + 70, size: 34, color: '#dce8f4', weight: 600 })}
        ${motionText(item.value, { x: 925, y: y + 76, size: 58, color: item.color, anchor: 'end' })}
        <rect x="155" y="${y + 125}" width="760" height="22" rx="11" fill="#253c56"/>
        <rect x="155" y="${y + 125}" width="${760 * item.amount * itemProgress}" height="22" rx="11" fill="${item.color}"/>
      </g>`
  }).join('')

  const policyMarkerX = 115 + 850 * 0.81 * policyLocal
  const ownershipNodes = [
    { label: 'Model', detail: 'Scores explicit choices', color: '#77b8ff' },
    { label: 'Policy layer', detail: 'Applies thresholds and permissions', color: '#55dbc8' },
    { label: 'Human owner', detail: 'Owns exceptions and irreversible calls', color: '#f5c84c' },
    { label: 'Decision record', detail: 'Preserves the evidence and version', color: '#ff9378' },
  ].map((item, index) => {
    const active = ease((ownershipLocal * 4) - index * 0.82)
    const y = 500 + index * 290
    const connector = index === 3 ? '' : `<line x1="540" y1="${y + 180}" x2="540" y2="${y + 260}" stroke="#4f6782" stroke-width="8"/><circle cx="540" cy="${y + 218}" r="${8 + active * 6}" fill="${item.color}" opacity="${0.35 + active * 0.65}"/>`
    return `
      <g opacity="${0.32 + active * 0.68}" transform="translate(0,${(1 - active) * 42})">
        ${motionCard({ x: 110, y, width: 860, height: 180, color: '#10243b', stroke: item.color })}
        <rect x="110" y="${y}" width="16" height="180" rx="8" fill="${item.color}"/>
        ${motionText(item.label, { x: 165, y: y + 72, size: 40, color: item.color })}
        ${motionText(item.detail, { x: 165, y: y + 125, size: 25, color: '#d9e4f0', weight: 400 })}
        ${connector}
      </g>`
  }).join('')

  return `
    <svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#061322"/>
          <stop offset="0.55" stop-color="#0b2037"/>
          <stop offset="1" stop-color="#101b31"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="35%" r="65%">
          <stop offset="0" stop-color="#1a5571" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#071525" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1080" height="1920" fill="url(#bg)"/>
      <rect width="1080" height="1920" fill="url(#glow)"/>
      ${backgroundDots}
      <rect x="0" y="0" width="1080" height="126" fill="#132943" opacity="0.96"/>
      ${motionText('AMADUTOWN ADVISORY SOLUTIONS', { x: 145, y: 70, size: 22, color: '#f5c84c', weight: 700 })}
      ${motionText('JEV DECISION INTERFACE', { x: 145, y: 101, size: 17, color: '#a9bdd2', weight: 600 })}
      <rect x="70" y="1840" width="940" height="10" rx="5" fill="#253c56"/>
      <rect x="70" y="1840" width="${940 * progress}" height="10" rx="5" fill="#55dbc8"/>

      <g opacity="${hookAlpha}" transform="translate(0,${(1 - hookEnter) * 70})">
        ${motionText('A score is not', { x: 80, y: 440, size: 85, color: '#f7f9fc' })}
        ${motionText('a decision.', { x: 80, y: 540, size: 85, color: '#f5c84c' })}
        ${motionText('Who owns the exception?', { x: 82, y: 630, size: 34, color: '#b8cbe0', weight: 500 })}
        <circle cx="540" cy="1080" r="${260 + pulse * 12}" fill="#0e263e" stroke="#55dbc8" stroke-width="${5 + pulse * 3}"/>
        ${motionText((0.81 * hookEnter).toFixed(2), { x: 540, y: 1096, size: 132, color: '#55dbc8', anchor: 'middle' })}
        ${motionText('typed probability', { x: 540, y: 1160, size: 31, color: '#d9e4f0', weight: 500, anchor: 'middle' })}
      </g>

      <g opacity="${signalAlpha}">
        ${motionText('Read the signal', { x: 80, y: 285, size: 72, color: '#f7f9fc' })}
        ${motionText('Three explicit choices. One bounded score.', { x: 82, y: 350, size: 29, color: '#b8cbe0', weight: 400 })}
        ${probabilityCards}
      </g>

      <g opacity="${policyAlpha}">
        ${motionText('Apply the policy', { x: 80, y: 285, size: 72, color: '#f7f9fc' })}
        ${motionText('Illustrative policy bands', { x: 82, y: 350, size: 28, color: '#b8cbe0', weight: 400 })}
        ${motionCard({ x: 75, y: 510, width: 930, height: 740, color: '#0d2036', stroke: '#3a5572' })}
        <rect x="115" y="760" width="467" height="90" rx="20" fill="#692f39" opacity="${0.45 + policyLocal * 0.45}"/>
        <rect x="582" y="760" width="212" height="90" fill="#735f24" opacity="${0.45 + policyLocal * 0.45}"/>
        <rect x="794" y="760" width="171" height="90" rx="20" fill="#1f665d" opacity="${0.45 + policyLocal * 0.45}"/>
        ${motionText('STOP', { x: 350, y: 817, size: 27, color: '#ffb7a8', anchor: 'middle' })}
        ${motionText('REVIEW', { x: 688, y: 817, size: 27, color: '#ffe397', anchor: 'middle' })}
        ${motionText('ROUTE', { x: 880, y: 817, size: 27, color: '#9af0dc', anchor: 'middle' })}
        <line x1="115" y1="900" x2="965" y2="900" stroke="#718aa5" stroke-width="8"/>
        <line x1="${policyMarkerX}" y1="700" x2="${policyMarkerX}" y2="955" stroke="#f5c84c" stroke-width="8" opacity="${policyLocal}"/>
        <circle cx="${policyMarkerX}" cy="900" r="24" fill="#f5c84c" opacity="${policyLocal}"/>
        ${motionText('0.81', { x: policyMarkerX, y: 660, size: 70, color: '#f5c84c', anchor: 'middle', opacity: policyLocal })}
        ${motionText('A score becomes actionable only inside', { x: 540, y: 1060, size: 30, color: '#d9e4f0', weight: 400, anchor: 'middle' })}
        ${motionText('a pre-authorized boundary.', { x: 540, y: 1105, size: 30, color: '#d9e4f0', weight: 400, anchor: 'middle' })}
      </g>

      <g opacity="${ownershipAlpha}">
        ${motionText('Keep ownership visible', { x: 80, y: 285, size: 65, color: '#f7f9fc' })}
        ${motionText('The system shows who owns each handoff.', { x: 82, y: 350, size: 28, color: '#b8cbe0', weight: 400 })}
        ${ownershipNodes}
      </g>

      <g opacity="${exceptionAlpha}">
        ${motionText('Who owns', { x: 540, y: 340, size: 78, color: '#f7f9fc', anchor: 'middle' })}
        ${motionText('the exception?', { x: 540, y: 430, size: 78, color: '#f5c84c', anchor: 'middle' })}
        <circle cx="540" cy="930" r="${260 + pulse * 10}" fill="#102943" stroke="#f5c84c" stroke-width="${6 + pulse * 4}" opacity="${exceptionLocal}"/>
        ${motionText('HUMAN', { x: 540, y: 905, size: 54, color: '#f5c84c', anchor: 'middle', opacity: exceptionLocal })}
        ${motionText('OWNER', { x: 540, y: 976, size: 74, color: '#f7f9fc', anchor: 'middle', opacity: exceptionLocal })}
        ${motionText('Exceptions and irreversible calls', { x: 540, y: 1060, size: 28, color: '#c7d7e8', weight: 400, anchor: 'middle', opacity: exceptionLocal })}
        <path d="M540 1225 L230 1440" stroke="#55dbc8" stroke-width="8" fill="none" opacity="${exceptionLocal}"/>
        <path d="M540 1225 L540 1510" stroke="#f5c84c" stroke-width="8" fill="none" opacity="${exceptionLocal}"/>
        <path d="M540 1225 L850 1440" stroke="#ff9378" stroke-width="8" fill="none" opacity="${exceptionLocal}"/>
        ${motionText('ROUTE', { x: 230, y: 1510, size: 28, color: '#55dbc8', anchor: 'middle', opacity: exceptionLocal })}
        ${motionText('REVIEW', { x: 540, y: 1590, size: 28, color: '#f5c84c', anchor: 'middle', opacity: exceptionLocal })}
        ${motionText('REFUSE', { x: 850, y: 1510, size: 28, color: '#ff9378', anchor: 'middle', opacity: exceptionLocal })}
      </g>

      <g opacity="${closeAlpha}" transform="translate(0,${(1 - closeLocal) * 60})">
        ${motionText('Make uncertainty', { x: 540, y: 650, size: 76, color: '#f7f9fc', anchor: 'middle' })}
        ${motionText('visible enough to act on.', { x: 540, y: 745, size: 62, color: '#f5c84c', anchor: 'middle' })}
        ${motionCard({ x: 110, y: 925, width: 860, height: 360, color: '#10243b', stroke: '#55dbc8' })}
        ${motionText('Score', { x: 540, y: 1015, size: 38, color: '#77b8ff', anchor: 'middle' })}
        ${motionText('Policy', { x: 540, y: 1090, size: 38, color: '#55dbc8', anchor: 'middle' })}
        ${motionText('Human owner', { x: 540, y: 1165, size: 38, color: '#f5c84c', anchor: 'middle' })}
        ${motionText('Decision record', { x: 540, y: 1240, size: 38, color: '#ff9378', anchor: 'middle' })}
      </g>
    </svg>
  `
}
