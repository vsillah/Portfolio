import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require('sharp')
const root = process.cwd()
const outputDir = resolve(root, 'public/review-assets/social-content/campaign-review')
const publicSourceDir = resolve(root, 'public/review-assets/social-content/source-proof')
const logo = resolve(root, 'public/amadutown-logo-upscaled.png')

mkdirSync(outputDir, { recursive: true })
mkdirSync(publicSourceDir, { recursive: true })

const jobs = [
  {
    slug: 'jev-linkedin-decision-system',
    source: resolve(root, 'artifacts/human-qa/artifact-video-review-2026-10-14/inputs/jev-operator-field-guide.png'),
    publicSource: resolve(publicSourceDir, 'jev-operator-field-guide.png'),
    accent: '#58D7CB', eyebrow: 'JEV / DECISION-ONLY AI',
    headline: ['THE MODEL MADE THE CHOICE.', 'THE SYSTEM OWNED THE OUTCOME.'],
    dek: 'A useful agent exposes the policy, owner, and receipt around its score.',
    proof: ['TYPED CHOICE', 'POLICY BOUNDARY', 'HUMAN OWNER', 'RECEIPT'], fit: 'contain',
  },
  {
    slug: 'dark-castle-linkedin-remember-why',
    source: resolve(root, 'public/review-assets/social-content/dark-castle-customer-facing-poster.png'),
    accent: '#F5C518', eyebrow: 'DARK CASTLE CHESS / LEARNING PROOF',
    headline: ['A RIGHT MOVE CAN BE AN ACCIDENT.', 'LEARNING NEEDS THE WHY.'],
    dek: 'The position, choice, consequence, and lesson should travel together.',
    proof: ['POSITION', 'CHOICE', 'CONSEQUENCE', 'LESSON'], fit: 'contain',
  },
  {
    slug: 'ai-audit-linkedin-hidden-bill',
    source: resolve(root, 'public/audit_calculator_img.png'),
    accent: '#E0B52F', eyebrow: 'AI AUDIT CALCULATOR / OPERATING COST',
    headline: ['THE INVOICE SHOWS THE LICENSE.', 'THE WORKFLOW SHOWS THE REAL BILL.'],
    dek: 'Count the owner, review burden, recovery work, and evidence behind the tool.',
    proof: ['WORKFLOW', 'OWNER', 'REVIEW HOURS', 'EVIDENCE'], fit: 'cover',
  },
]

const youtubeJobs = [
  {
    slug: 'dark-castle-youtube-remember-the-why',
    source: resolve(root, 'public/review-assets/social-content/dark-castle-customer-facing-poster.png'),
    accent: '#F5C518',
    eyebrow: 'DARK CASTLE CHESS',
    teaser: ['REMEMBER', 'THE WHY'],
    subline: "THE MOVE ISN'T THE LESSON",
    proof: 'POSITION  •  CHOICE  •  CONSEQUENCE',
    extract: { left: 30, top: 130, width: 1170, height: 800 },
    fit: 'cover',
  },
  {
    slug: 'ai-audit-youtube-who-owns-the-cleanup',
    source: resolve(root, 'public/audit_calculator_img.png'),
    accent: '#E0B52F',
    eyebrow: 'AI AUDIT CALCULATOR',
    teaser: ['WHO', 'OWNS THE', 'CLEANUP?'],
    subline: 'THE LICENSE IS ONLY THE START',
    proof: 'REVIEW  •  RECOVERY  •  EVIDENCE',
    extract: { left: 0, top: 0, width: 1408, height: 1100 },
    fit: 'contain',
  },
]

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function overlaySvg(job) {
  const chips = job.proof.map((label, index) => {
    const x = 80 + (index * 265)
    return `<rect x="${x}" y="1245" width="245" height="112" rx="12" fill="#10243D"/><rect x="${x}" y="1245" width="245" height="5" fill="${job.accent}"/><text x="${x + 18}" y="1304" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(label)}</text>`
  }).join('')
  return Buffer.from(`<svg width="1200" height="1500" xmlns="http://www.w3.org/2000/svg">
    <text x="170" y="92" fill="${job.accent}" font-family="Arial, sans-serif" font-size="24" font-weight="700">AMADUTOWN ADVISORY SOLUTIONS</text>
    <text x="80" y="174" fill="${job.accent}" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1.5">${escapeXml(job.eyebrow)}</text>
    <text x="80" y="258" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="54" font-weight="700"><tspan x="80" dy="0">${escapeXml(job.headline[0])}</tspan><tspan x="80" dy="67">${escapeXml(job.headline[1])}</tspan></text>
    <text x="80" y="415" fill="#C6D3E3" font-family="Arial, sans-serif" font-size="28">${escapeXml(job.dek)}</text>
    <rect x="80" y="465" width="1040" height="4" fill="${job.accent}"/>
    <rect x="80" y="485" width="1040" height="720" rx="16" fill="none" stroke="#314966" stroke-width="3"/>
    ${chips}
    <text x="80" y="1440" fill="#91A5BC" font-family="Arial, sans-serif" font-size="18">OWNED PRODUCT PROOF / REVIEW-ONLY ASSET</text>
  </svg>`)
}

function youtubeOverlaySvg(job) {
  const teaserY = job.teaser.length === 3 ? 188 : 240
  const teaserSize = job.teaser.length === 3 ? 64 : 76
  const teaserLines = job.teaser.map((line, index) => `<tspan x="52" dy="${index === 0 ? 0 : teaserSize + 8}">${escapeXml(line)}</tspan>`).join('')
  return Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
    <rect width="1280" height="720" fill="#071426" fill-opacity="0.82"/>
    <rect x="0" y="0" width="18" height="720" fill="${job.accent}"/>
    <rect x="548" y="68" width="678" height="584" rx="22" fill="#071426" stroke="${job.accent}" stroke-width="5"/>
    <rect x="52" y="54" width="430" height="42" rx="21" fill="#10243D" stroke="${job.accent}" stroke-width="2"/>
    <text x="76" y="82" fill="${job.accent}" font-family="Arial, sans-serif" font-size="21" font-weight="700" letter-spacing="1.2">${escapeXml(job.eyebrow)}</text>
    <text x="52" y="${teaserY}" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${teaserSize}" font-weight="800">${teaserLines}</text>
    <rect x="52" y="374" width="430" height="6" fill="${job.accent}"/>
    <text x="52" y="425" fill="#D8E3EF" font-family="Arial, sans-serif" font-size="25" font-weight="700">${escapeXml(job.subline)}</text>
    <rect x="52" y="520" width="430" height="76" rx="14" fill="#10243D" stroke="#314966" stroke-width="2"/>
    <text x="76" y="566" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(job.proof)}</text>
    <text x="52" y="664" fill="#9AAFC4" font-family="Arial, sans-serif" font-size="17" font-weight="700">OWNED PRODUCT PROOF  /  REVIEW ONLY</text>
  </svg>`)
}

for (const job of jobs) {
  const proof = await sharp(job.source).resize(1040, 720, { fit: job.fit, position: 'top', background: '#071426' }).png().toBuffer()
  const logoImage = await sharp(logo).resize({ width: 72 }).png().toBuffer()
  await sharp({ create: { width: 1200, height: 1500, channels: 4, background: '#071426' } })
    .composite([
      { input: proof, left: 80, top: 485 },
      { input: logoImage, left: 80, top: 42 },
      { input: overlaySvg(job), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDir, `${job.slug}.png`))
  if (job.publicSource) copyFileSync(job.source, job.publicSource)
}

for (const job of youtubeJobs) {
  const background = await sharp(job.source)
    .resize(1280, 720, { fit: 'cover' })
    .modulate({ brightness: 0.28, saturation: 0.7 })
    .blur(8)
    .png()
    .toBuffer()
  const productProof = await sharp(job.source)
    .extract(job.extract)
    .resize(650, 556, { fit: job.fit, position: 'top', background: '#071426' })
    .png()
    .toBuffer()

  await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#071426' } })
    .composite([
      { input: background, left: 0, top: 0 },
      { input: youtubeOverlaySvg(job), left: 0, top: 0 },
      { input: productProof, left: 562, top: 82 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(resolve(outputDir, `${job.slug}.png`))
}
