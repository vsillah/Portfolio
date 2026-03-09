/**
 * Generate diagrammatic SVG assets for the about-page video storyboard.
 * Writes to design-files/about-page-video/.
 * AmaduTown palette: Imperial Navy #121E31, Radiant Gold #D4AF37, Silicon Slate #2C3E50,
 * Platinum White #EAECEE, Gold Light #F5D060, Bronze #8B6914.
 *
 * Usage: npx tsx scripts/generate-storyboard-schematics.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const OUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')
const COLORS = {
  navy: '#121E31',
  gold: '#D4AF37',
  slate: '#2C3E50',
  white: '#EAECEE',
  goldLight: '#F5D060',
  bronze: '#8B6914',
}

function svgDoc(
  width: number,
  height: number,
  content: string,
  extraFilter?: string
): string {
  const filter = extraFilter ?? ''
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feFlood flood-color="${COLORS.gold}" flood-opacity="0.4"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    ${filter}
  </defs>
  <rect width="100%" height="100%" fill="${COLORS.navy}"/>
  ${content}
</svg>`
}

function roundedRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
  stroke: string,
  glow = false
): string {
  const el = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`
  return glow ? `<g filter="url(#glow)">${el}</g>` : el
}

function text(
  x: number,
  y: number,
  str: string,
  fill: string,
  fontSize: number,
  anchor: 'start' | 'middle' | 'end' = 'middle'
): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="system-ui, sans-serif" font-size="${fontSize}" text-anchor="${anchor}" font-weight="500">${escapeXml(str)}</text>`
}

function line(x1: number, y1: number, x2: number, y2: number, stroke: string): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1" stroke-dasharray="4 2"/>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const W = 800
const H = 450
const CX = W / 2
const CY = H / 2

const schematics: { name: string; fn: () => string }[] = [
  {
    name: 'schematic-hub.svg',
    fn: () => {
      const box = roundedRect(CX - 120, CY - 50, 240, 100, 16, COLORS.slate, COLORS.gold, true)
      const title = text(CX, CY - 10, 'AmaduTown', COLORS.white, 28)
      const tag = text(CX, CY + 22, 'portfolio · store · product', COLORS.goldLight, 14)
      return svgDoc(W, H, box + title + tag)
    },
  },
  {
    name: 'schematic-hub-sections.svg',
    fn: () => {
      const outer = roundedRect(CX - 180, CY - 100, 360, 200, 20, 'transparent', COLORS.gold, true)
      const s1 = roundedRect(CX - 160, CY - 75, 150, 70, 12, COLORS.slate, COLORS.gold)
      const s2 = roundedRect(CX + 10, CY - 75, 150, 70, 12, COLORS.slate, COLORS.gold)
      const s3 = roundedRect(CX - 160, CY + 5, 150, 70, 12, COLORS.slate, COLORS.gold)
      const s4 = roundedRect(CX + 10, CY + 5, 150, 70, 12, COLORS.slate, COLORS.gold)
      const t1 = text(CX - 85, CY - 38, 'Services', COLORS.white, 16)
      const t2 = text(CX + 85, CY - 38, 'Store', COLORS.white, 16)
      const t3 = text(CX - 85, CY + 42, 'Tools', COLORS.white, 16)
      const t4 = text(CX + 85, CY + 42, 'Automation', COLORS.white, 16)
      return svgDoc(W, H, outer + s1 + s2 + s3 + s4 + t1 + t2 + t3 + t4)
    },
  },
  {
    name: 'schematic-hub-modules.svg',
    fn: () => {
      const outer = roundedRect(CX - 200, CY - 95, 400, 190, 20, 'transparent', COLORS.gold, true)
      const modules = [
        { label: 'Chatbot', x: CX - 160, y: CY - 70 },
        { label: 'Lead Gen', x: CX, y: CY - 70 },
        { label: 'Eval', x: CX + 160, y: CY - 70 },
        { label: 'Diagnostic', x: CX - 80, y: CY + 50 },
        { label: 'n8n', x: CX + 80, y: CY + 50 },
      ]
      let content = outer
      modules.forEach(({ label, x, y }) => {
        content += roundedRect(x - 55, y - 22, 110, 44, 10, COLORS.slate, COLORS.gold)
        content += text(x, y + 5, label, COLORS.white, 14)
      })
      return svgDoc(W, H, content)
    },
  },
  {
    name: 'schematic-modules-detached.svg',
    fn: () => {
      const hub = roundedRect(CX - 50, CY - 30, 100, 60, 12, COLORS.slate, COLORS.bronze)
      const modules = [
        { label: 'Chatbot', x: 120, y: 120 },
        { label: 'Lead Gen', x: W - 120, y: 120 },
        { label: 'Eval', x: 120, y: H - 100 },
        { label: 'Diagnostic', x: W - 120, y: H - 100 },
        { label: 'n8n', x: CX, y: 60 },
      ]
      let content = hub + text(CX, CY, 'Hub', COLORS.goldLight, 12)
      modules.forEach(({ label, x, y }) => {
        content += roundedRect(x - 52, y - 20, 104, 40, 8, COLORS.slate, COLORS.gold)
        content += text(x, y + 5, label, COLORS.white, 13)
        content += line(CX, CY, x, y, COLORS.gold)
      })
      return svgDoc(W, H, content)
    },
  },
  {
    name: 'schematic-modules-availability.svg',
    fn: () => {
      const hub = roundedRect(CX - 50, CY - 30, 100, 60, 12, COLORS.slate, COLORS.bronze)
      const modules = [
        { label: 'Chatbot', x: 120, y: 120 },
        { label: 'Lead Gen', x: W - 120, y: 120 },
        { label: 'Eval', x: 120, y: H - 100 },
        { label: 'Diagnostic', x: W - 120, y: H - 100 },
        { label: 'n8n', x: CX, y: 60 },
      ]
      let content = hub
      modules.forEach(({ label, x, y }) => {
        content += roundedRect(x - 52, y - 20, 104, 40, 8, COLORS.slate, COLORS.gold)
        content += text(x, y + 5, label, COLORS.white, 13)
        content += line(CX, CY, x, y, COLORS.gold)
      })
      content += text(CX, H - 40, 'Whitelabel · Download · Spin off into your stack', COLORS.goldLight, 16)
      return svgDoc(W, H, content)
    },
  },
  {
    name: 'schematic-cta.svg',
    fn: () => {
      const card = roundedRect(CX - 180, CY - 55, 360, 110, 20, COLORS.slate, COLORS.gold, true)
      const title = text(CX, CY - 15, 'Build with what\'s proven.', COLORS.white, 26)
      const sub = text(CX, CY + 25, 'Explore AmaduTown', COLORS.goldLight, 22)
      return svgDoc(W, H, card + title + sub)
    },
  },
  {
    name: 'schematic-spinoff-flow.svg',
    fn: () => {
      const a = roundedRect(80, CY - 40, 160, 80, 12, COLORS.slate, COLORS.gold)
      const b = roundedRect(CX - 80, CY - 40, 160, 80, 12, COLORS.slate, COLORS.gold)
      const c = roundedRect(W - 240, CY - 40, 160, 80, 12, COLORS.slate, COLORS.gold)
      const t1 = text(160, CY + 5, 'Portfolio repo', COLORS.white, 14)
      const t2 = text(CX, CY + 5, 'Module Sync', COLORS.white, 14)
      const t3 = text(W - 160, CY + 5, 'Spin-off repo', COLORS.white, 14)
      const arrow1 = line(240, CY, CX - 80, CY)
      const arrow2 = line(CX + 80, CY, W - 240, CY)
      return svgDoc(W, H, a + b + c + t1 + t2 + t3 + arrow1 + arrow2)
    },
  },
]

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true })
    console.log('Created', OUT_DIR)
  }
  for (const { name, fn } of schematics) {
    const outPath = path.join(OUT_DIR, name)
    fs.writeFileSync(outPath, fn(), 'utf8')
    console.log('Wrote', outPath)
  }
  console.log('Done. Schematics in', OUT_DIR)
}

main()
