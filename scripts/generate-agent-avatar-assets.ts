import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { AGENT_AVATARS, getAvatarToneStyles } from '../lib/agent-avatars'

const outputDir = path.join(process.cwd(), 'public', 'agent-avatars')

const motifGlyphs: Record<string, string> = {
  arch: 'A',
  bolt: 'B',
  book: 'B',
  coin: 'C',
  crown: 'C',
  diamond: 'D',
  eye: 'E',
  forge: 'F',
  helm: 'H',
  link: 'L',
  moon: 'M',
  net: 'N',
  node: 'N',
  obelisk: 'O',
  pen: 'P',
  route: 'R',
  scroll: 'S',
  shield: 'S',
  signal: 'S',
  star: '*',
  sun: 'S',
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function avatarSvg(agentKey: string) {
  const avatar = AGENT_AVATARS[agentKey]
  const tone = getAvatarToneStyles(avatar.tone)
  const glyph = motifGlyphs[avatar.motif] ?? avatar.motif.slice(0, 1).toUpperCase()
  const label = escapeXml(avatar.label)
  const cue = escapeXml(avatar.culturalCue)
  const initials = escapeXml(avatar.initials)
  const seed = Array.from(agentKey).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const browTilt = seed % 2 === 0 ? 'M36 89c14 8 28 8 42 0' : 'M37 91c13 5 26 5 39-2'
  const headWrap = seed % 3 === 0
    ? 'M39 54c7-19 20-30 41-30s34 11 41 30c-12-6-26-9-41-9s-29 3-41 9Z'
    : seed % 3 === 1
      ? 'M42 51c5-17 19-27 38-27s33 10 38 27c-8-4-20-8-38-8s-30 4-38 8Z'
      : 'M35 57c9-22 23-34 45-34s36 12 45 34c-15-8-30-12-45-12s-30 4-45 12Z'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">${label}</title>
  <desc id="desc">Stylized animated-style portrait mark with ${cue}; historically inspired without claiming exact photographic likeness.</desc>
  <defs>
    <radialGradient id="halo" cx="32%" cy="18%" r="75%">
      <stop offset="0%" stop-color="${tone.mark}" stop-opacity="0.55"/>
      <stop offset="48%" stop-color="${tone.ring}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#07111f" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="body" x1="18" y1="16" x2="142" y2="152" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${tone.wash}"/>
      <stop offset="62%" stop-color="#0d1b2d"/>
      <stop offset="100%" stop-color="#050b14"/>
    </linearGradient>
    <filter id="softGlow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0 0 0.82 0 0 0 0 0 0.38 0 0 0 0 0 0.45 0"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="160" height="160" rx="32" fill="url(#body)"/>
  <rect x="8" y="8" width="144" height="144" rx="27" fill="url(#halo)" opacity="0.88"/>
  <path d="M28 139c7-32 24-50 52-50s45 18 52 50" fill="#14243a" opacity="0.98"/>
  <path d="M45 139c6-20 18-31 35-31s29 11 35 31" fill="${tone.wash}" opacity="0.65"/>
  <ellipse cx="80" cy="70" rx="34" ry="38" fill="#111d2f"/>
  <path d="${headWrap}" fill="${tone.ring}" opacity="0.72"/>
  <path d="M43 59c13-11 25-17 37-17s24 6 37 17" fill="none" stroke="${tone.mark}" stroke-width="5" stroke-linecap="round" opacity="0.65"/>
  <circle cx="64" cy="71" r="3.7" fill="${tone.mark}" opacity="0.88"/>
  <circle cx="96" cy="71" r="3.7" fill="${tone.mark}" opacity="0.88"/>
  <path d="${browTilt}" fill="none" stroke="${tone.mark}" stroke-width="4" stroke-linecap="round" opacity="0.65"/>
  <path d="M65 83c10 8 20 8 30 0" fill="none" stroke="${tone.mark}" stroke-width="4" stroke-linecap="round" opacity="0.58"/>
  <path d="M39 112c14 11 28 17 41 17s27-6 41-17" fill="none" stroke="${tone.ring}" stroke-width="3" opacity="0.38"/>
  <circle cx="122" cy="37" r="21" fill="#07111f" stroke="${tone.ring}" stroke-width="3" filter="url(#softGlow)"/>
  <text x="122" y="44" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" fill="${tone.mark}">${escapeXml(glyph)}</text>
  <rect x="18" y="120" width="45" height="24" rx="12" fill="#020817" opacity="0.72"/>
  <text x="40.5" y="137" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800" letter-spacing="1" fill="${tone.mark}">${initials}</text>
  <rect x="8" y="8" width="144" height="144" rx="27" fill="none" stroke="${tone.ring}" stroke-opacity="0.64" stroke-width="2"/>
</svg>
`
}

function unknownSvg() {
  const tone = getAvatarToneStyles('cyan')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-labelledby="title desc">
  <title id="title">Illustrated avatar for unassigned agent work</title>
  <desc id="desc">Fallback stylized animated-style portrait mark for unassigned Agent Ops work.</desc>
  <rect width="160" height="160" rx="32" fill="#07111f"/>
  <rect x="8" y="8" width="144" height="144" rx="27" fill="${tone.wash}" opacity="0.88"/>
  <circle cx="80" cy="70" r="36" fill="#111d2f"/>
  <path d="M35 57c9-22 23-34 45-34s36 12 45 34c-15-8-30-12-45-12s-30 4-45 12Z" fill="${tone.ring}" opacity="0.58"/>
  <circle cx="64" cy="72" r="4" fill="${tone.mark}" opacity="0.8"/>
  <circle cx="96" cy="72" r="4" fill="${tone.mark}" opacity="0.8"/>
  <path d="M65 84c10 8 20 8 30 0" fill="none" stroke="${tone.mark}" stroke-width="4" stroke-linecap="round" opacity="0.58"/>
  <circle cx="122" cy="37" r="21" fill="#07111f" stroke="${tone.ring}" stroke-width="3"/>
  <text x="122" y="44" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="800" fill="${tone.mark}">N</text>
  <rect x="18" y="120" width="45" height="24" rx="12" fill="#020817" opacity="0.72"/>
  <text x="40.5" y="137" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800" letter-spacing="1" fill="${tone.mark}">AI</text>
  <rect x="8" y="8" width="144" height="144" rx="27" fill="none" stroke="${tone.ring}" stroke-opacity="0.64" stroke-width="2"/>
</svg>
`
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  await Promise.all(
    Object.keys(AGENT_AVATARS).map((agentKey) => (
      writeFile(path.join(outputDir, `${agentKey}.svg`), avatarSvg(agentKey), 'utf8')
    )),
  )
  await writeFile(path.join(outputDir, 'unknown.svg'), unknownSvg(), 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
