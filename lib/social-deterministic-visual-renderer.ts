import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import type { FrameworkVisualType } from '@/lib/social-content'
import {
  deterministicArchitectureStructureIssue,
  type DeterministicVisualSpec,
} from '@/lib/social-practitioner-content'

const DIMENSIONS: Record<DeterministicVisualSpec['aspect_ratio'], { width: number; height: number }> = {
  '1.91:1': { width: 1200, height: 628 },
  '1:1': { width: 1080, height: 1080 },
  '4:5': { width: 1080, height: 1350 },
  '9:16': { width: 1080, height: 1920 },
}

const INTERNAL_VISIBLE_TEXT_PATTERNS = [
  /deterministic\s+review\s+asset/i,
  /provider\s+(?:none|not[\s_-]*called|disabled|off)/i,
  /human\s+approval\s+(?:required|pending)/i,
  /approval\s+(?:required|pending)/i,
  /external\s+call\s+(?:false|disabled|off)/i,
  /internal\s+(?:review|governance|only)/i,
  /(?:for\s+)?review\s+only/i,
  /not\s+for\s+publication/i,
  /draft\s+asset/i,
]

export function assertPublicationSafeDeterministicVisualSvg(svg: string): void {
  const unsafePattern = INTERNAL_VISIBLE_TEXT_PATTERNS.find((pattern) => pattern.test(svg))
  if (unsafePattern) {
    throw new Error('Deterministic visual contains internal governance text that is not safe for publication.')
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function wrap(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = truncate(value, maxCharacters * maxLines).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxCharacters || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines - 1) break
  }
  if (current && lines.length < maxLines) lines.push(current)
  const consumed = lines.join(' ').split(/\s+/).filter(Boolean).length
  if (consumed < words.length && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…$/, '').replace(/[.,;:]$/, '')}…`
  }
  return lines
}

function textLines(input: {
  lines: string[]
  x: number
  y: number
  lineHeight: number
  className: string
}): string {
  return `<text x="${input.x}" y="${input.y}" class="${input.className}">${input.lines
    .map((line, index) => `<tspan x="${input.x}" dy="${index === 0 ? 0 : input.lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`
}

function horizontalSvg(spec: DeterministicVisualSpec, width: number, height: number): string {
  const headline = wrap(spec.headline, 25, 3)
  const evidence = spec.evidence_lines.slice(0, 3).map((line) => truncate(line, 76))
  const nodes = spec.architecture!.nodes
  const connectors = spec.architecture!.connectors
  const accents = ['#f4b942', '#5dd4c8', '#9fc5ff']
  const cardWidth = 300
  const cardGap = 88
  const cards = nodes.map((node, index) => {
    const x = 62 + index * (cardWidth + cardGap)
    const bodyLines = wrap(node.body, 31, 4)
    return `
      <g data-architecture-node="${escapeXml(node.id)}">
        <rect x="${x}" y="344" width="${cardWidth}" height="190" rx="22" fill="#111d31" stroke="#33445f" stroke-width="2"/>
        <rect x="${x}" y="344" width="${cardWidth}" height="8" rx="4" fill="${accents[index]}"/>
        <text x="${x + 22}" y="382" class="stage" fill="${accents[index]}">${escapeXml(node.label.toUpperCase())}</text>
        ${textLines({ lines: bodyLines, x: x + 22, y: 416, lineHeight: 25, className: 'body' })}
      </g>`
  }).join('')
  const connectorPaths = connectors.map((connector, index) => {
    const startX = 62 + index * (cardWidth + cardGap) + cardWidth + 8
    const endX = 62 + (index + 1) * (cardWidth + cardGap) - 12
    const middleX = Math.round((startX + endX) / 2)
    return `<g data-architecture-connector="${escapeXml(connector.from)}:${escapeXml(connector.to)}">
      <path d="M${startX} 442 H${endX}" class="connector-line" marker-end="url(#architecture-arrow)"/>
      <text x="${middleX}" y="336" text-anchor="middle" class="connector">${escapeXml(truncate(connector.label.toUpperCase(), 18))}</text>
    </g>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#07101f"/>
        <stop offset="0.58" stop-color="#0b1728"/>
        <stop offset="1" stop-color="#15223a"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.82" cy="0.18" r="0.62">
        <stop offset="0" stop-color="#f4b942" stop-opacity="0.18"/>
        <stop offset="1" stop-color="#f4b942" stop-opacity="0"/>
      </radialGradient>
      <marker id="architecture-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#86a9c9"/>
      </marker>
      <style>
        text { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .eyebrow { fill: #f4c96b; font-size: 18px; font-weight: 750; letter-spacing: 3px; }
        .headline { fill: #f7fafc; font-size: 46px; font-weight: 760; letter-spacing: -1px; }
        .stage { font-size: 15px; font-weight: 760; letter-spacing: 1.8px; }
        .body { fill: #dbe7f7; font-size: 18px; font-weight: 520; }
        .connector { fill: #9eb8d1; font-size: 10px; font-weight: 700; letter-spacing: 0.8px; }
        .connector-line { fill: none; stroke: #86a9c9; stroke-width: 4; stroke-linecap: round; }
        .evidence { fill: #b9c8dc; font-size: 16px; font-weight: 520; }
        .result { fill: #07101f; font-size: 15px; font-weight: 760; letter-spacing: 1px; }
        .footer { fill: #9eb0c7; font-size: 14px; font-weight: 560; }
      </style>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <circle cx="1110" cy="80" r="170" fill="#f4b942" opacity="0.035"/>
    <path d="M62 318 H1138" stroke="#32425b" stroke-width="2"/>
    <text x="62" y="70" class="eyebrow">${escapeXml(spec.eyebrow.toUpperCase())}</text>
    ${textLines({ lines: headline, x: 62, y: 126, lineHeight: 50, className: 'headline' })}
    <g transform="translate(720,104)">
      ${evidence.map((line, index) => `<g transform="translate(0,${index * 48})"><circle cx="8" cy="-5" r="5" fill="#5dd4c8"/><text x="27" y="0" class="evidence">${escapeXml(line)}</text></g>`).join('')}
    </g>
    <g transform="translate(62,276)">
      <rect x="0" y="0" width="${Math.min(360, Math.max(190, spec.result_label.length * 9 + 42))}" height="36" rx="18" fill="#f4b942"/>
      <text x="20" y="24" class="result">${escapeXml(truncate(spec.result_label.toUpperCase(), 36))}</text>
    </g>
    <g data-visual-type="architecture">
      ${connectorPaths}
      ${cards}
    </g>
    <text x="600" y="584" text-anchor="middle" class="footer">AmaduTown Advisory Solutions</text>
  </svg>`
}

function verticalSvg(spec: DeterministicVisualSpec, width: number, height: number): string {
  const headline = wrap(spec.headline, 25, 4)
  const compact = height < 1200
  const top = compact ? 82 : 110
  const headlineSize = compact ? 52 : 62
  const cardTop = compact ? 390 : 500
  const cardGap = compact ? 36 : 48
  const cardHeight = Math.floor((height - cardTop - 150 - cardGap * 2) / 3)
  const nodes = spec.architecture!.nodes
  const connectors = spec.architecture!.connectors
  const accents = ['#f4b942', '#5dd4c8', '#9fc5ff']
  const cards = nodes.map((node, index) => {
    const y = cardTop + index * (cardHeight + cardGap)
    const bodyLines = wrap(node.body, compact ? 54 : 44, compact ? 2 : 4)
    return `<g data-architecture-node="${escapeXml(node.id)}">
      <rect x="70" y="${y}" width="940" height="${cardHeight}" rx="28" fill="#111d31" stroke="#33445f" stroke-width="2"/>
      <rect x="70" y="${y}" width="10" height="${cardHeight}" rx="5" fill="${accents[index]}"/>
      <text x="112" y="${y + 50}" class="stage" fill="${accents[index]}">${escapeXml(node.label.toUpperCase())}</text>
      ${textLines({ lines: bodyLines, x: 112, y: y + 96, lineHeight: compact ? 31 : 36, className: 'body' })}
    </g>`
  }).join('')
  const connectorPaths = connectors.map((connector, index) => {
    const startY = cardTop + index * (cardHeight + cardGap) + cardHeight + 5
    const endY = cardTop + (index + 1) * (cardHeight + cardGap) - 10
    const middleY = Math.round((startY + endY) / 2)
    return `<g data-architecture-connector="${escapeXml(connector.from)}:${escapeXml(connector.to)}">
      <path d="M540 ${startY} V${endY}" class="connector-line" marker-end="url(#architecture-arrow)"/>
      <text x="570" y="${middleY + 5}" class="connector">${escapeXml(truncate(connector.label.toUpperCase(), 24))}</text>
    </g>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07101f"/><stop offset="1" stop-color="#15223a"/></linearGradient>
      <marker id="architecture-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#86a9c9"/></marker>
      <style>
        text { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .eyebrow { fill: #f4c96b; font-size: 21px; font-weight: 750; letter-spacing: 3px; }
        .headline { fill: #f7fafc; font-size: ${headlineSize}px; font-weight: 760; letter-spacing: -1px; }
        .stage { font-size: 18px; font-weight: 760; letter-spacing: 1.8px; }
        .body { fill: #dbe7f7; font-size: ${compact ? 24 : 27}px; font-weight: 520; }
        .connector { fill: #9eb8d1; font-size: ${compact ? 12 : 14}px; font-weight: 700; letter-spacing: 0.8px; }
        .connector-line { fill: none; stroke: #86a9c9; stroke-width: 5; stroke-linecap: round; }
        .result { fill: #07101f; font-size: 18px; font-weight: 760; letter-spacing: 1px; }
        .footer { fill: #9eb0c7; font-size: 16px; font-weight: 560; }
      </style>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <circle cx="960" cy="100" r="220" fill="#f4b942" opacity="0.05"/>
    <text x="70" y="${top}" class="eyebrow">${escapeXml(spec.eyebrow.toUpperCase())}</text>
    ${textLines({ lines: headline, x: 70, y: top + 76, lineHeight: headlineSize + 5, className: 'headline' })}
    <g transform="translate(70,${cardTop - 70})"><rect width="360" height="42" rx="21" fill="#f4b942"/><text x="22" y="28" class="result">${escapeXml(truncate(spec.result_label.toUpperCase(), 36))}</text></g>
    <g data-visual-type="architecture">
      ${connectorPaths}
      ${cards}
    </g>
    <text x="540" y="${height - 64}" text-anchor="middle" class="footer">AmaduTown Advisory Solutions</text>
  </svg>`
}

export function buildDeterministicVisualSvg(spec: DeterministicVisualSpec, visualType: FrameworkVisualType): string {
  if (visualType !== spec.visual_type) {
    throw new Error(`Selected visual type ${visualType} does not match candidate visual type ${spec.visual_type || 'unset'}.`)
  }
  if (visualType !== 'architecture') {
    throw new Error(`No strict deterministic composition exists for visual type ${visualType}.`)
  }
  const architectureIssue = deterministicArchitectureStructureIssue(spec)
  if (architectureIssue) throw new Error(architectureIssue)
  const dimensions = DIMENSIONS[spec.aspect_ratio] ?? DIMENSIONS['1.91:1']
  const svg = spec.aspect_ratio === '1.91:1'
    ? horizontalSvg(spec, dimensions.width, dimensions.height)
    : verticalSvg(spec, dimensions.width, dimensions.height)
  assertPublicationSafeDeterministicVisualSvg(svg)
  return svg
}

export async function loadAmaduTownLogoPng(): Promise<Buffer> {
  return readFile(path.join(process.cwd(), 'public', 'amadutown-logo-upscaled.png'))
}

export async function renderDeterministicVisualPng(input: {
  spec: DeterministicVisualSpec
  visualType: FrameworkVisualType
  logoPng: Buffer
}): Promise<Buffer> {
  const dimensions = DIMENSIONS[input.spec.aspect_ratio] ?? DIMENSIONS['1.91:1']
  const svg = buildDeterministicVisualSvg(input.spec, input.visualType)
  const logoHeight = input.spec.aspect_ratio === '1.91:1' ? 76 : 92
  const logo = await sharp(input.logoPng)
    .resize({ height: logoHeight, withoutEnlargement: true })
    .png()
    .toBuffer({ resolveWithObject: true })
  const left = dimensions.width - logo.info.width - (input.spec.aspect_ratio === '1.91:1' ? 62 : 70)
  const top = input.spec.aspect_ratio === '1.91:1' ? 34 : 46
  return sharp(Buffer.from(svg))
    .composite([{ input: logo.data, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer()
}
