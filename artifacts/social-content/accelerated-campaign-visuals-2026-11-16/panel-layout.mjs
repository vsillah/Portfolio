import sharp from 'sharp'

export const PANEL_PADDING = 28
const widthCache = new Map()

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function measureLine(text, size, family, weight) {
  if (!text) return 0
  const key = JSON.stringify([text, size, family, weight])
  if (widthCache.has(key)) return widthCache.get(key)
  const svg = Buffer.from(`<svg width="3200" height="160" xmlns="http://www.w3.org/2000/svg"><text x="12" y="110" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="#fff">${escapeXml(text)}</text></svg>`)
  const { info } = await sharp(svg).trim().png().toBuffer({ resolveWithObject: true })
  const width = info.width
  widthCache.set(key, width)
  return width
}

async function wrapToWidth(value, limit, size, family, weight) {
  if (!value) return []
  const lines = []
  let current = ''
  for (const word of String(value).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word
    if (await measureLine(candidate, size, family, weight) <= limit) {
      current = candidate
      continue
    }
    if (!current) throw new Error(`Panel word exceeds available width: ${word}`)
    lines.push(current)
    current = word
    if (await measureLine(current, size, family, weight) > limit) throw new Error(`Panel word exceeds available width: ${word}`)
  }
  if (current) lines.push(current)
  return lines
}

export async function layoutPanel({ title, body = '', maxWidth }) {
  if (!title || !maxWidth) throw new Error('Panel requires title and maxWidth')
  const spacious = maxWidth > 700
  const titleSize = spacious ? 54 : 44
  const titleLineHeight = spacious ? 64 : 53
  const bodySize = spacious ? 30 : 30
  const bodyLineHeight = spacious ? 42 : 40
  const titleFamily = 'Georgia, Times New Roman, serif'
  const bodyFamily = 'Arial, Helvetica, sans-serif'
  const textLimit = maxWidth - 2 * PANEL_PADDING - 4
  const titleLines = await wrapToWidth(title, textLimit, titleSize, titleFamily, 700)
  const bodyLines = await wrapToWidth(body, textLimit, bodySize, bodyFamily, 500)
  const widths = await Promise.all([
    ...titleLines.map((line) => measureLine(line, titleSize, titleFamily, 700)),
    ...bodyLines.map((line) => measureLine(line, bodySize, bodyFamily, 500)),
  ])
  const width = Math.min(maxWidth, Math.max(220, Math.ceil(Math.max(...widths) + 2 * PANEL_PADDING + 4)))
  const titleY = PANEL_PADDING + titleSize
  const lastTitleY = titleY + (titleLines.length - 1) * titleLineHeight
  const bodyY = bodyLines.length ? lastTitleY + 25 + bodySize : null
  const lastY = bodyLines.length ? bodyY + (bodyLines.length - 1) * bodyLineHeight : lastTitleY
  const height = Math.ceil(lastY + (bodyLines.length ? bodySize * 0.24 : titleSize * 0.24) + PANEL_PADDING)
  return { width, height, padding: PANEL_PADDING, titleLines, bodyLines, titleY, bodyY, titleSize, titleLineHeight, bodySize, bodyLineHeight, titleFamily, bodyFamily }
}
