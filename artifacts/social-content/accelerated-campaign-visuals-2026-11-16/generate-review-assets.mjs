import sharp from 'sharp'
import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { layoutPanel, PANEL_PADDING, measureLine } from './panel-layout.mjs'
import { verifySourceBindings, sha256, ORIGINAL_GENERATOR_SHA256, ORIGINAL_RENDER_RECEIPT_SHA256 } from './source-bindings.mjs'

const execFileAsync = promisify(execFile)
const root = path.resolve('artifacts/social-content/accelerated-campaign-visuals-2026-11-16')
const source = path.join(root, 'sources')
const output = path.join(root, 'review-assets-content-fit')
const work = path.join(root, 'work-content-fit')
const manifestHash = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'

const assets = {
  logo: path.join(source, 'repo/public/amadutown-logo-upscaled.png'),
  posterL01: path.join(source, 'repo/public/accelerated/posters/l01-poster.webp'),
  posterL12: path.join(source, 'repo/public/accelerated/posters/l12-poster-desktop-53dd8b6f8e15.webp'),
  framework: path.join(source, 'drive/canonical-sam-framework.png'),
  signals: path.join(source, 'repo/public/showcases/service-prototypes/v2/sam-signals-plate.webp'),
  alignment: path.join(source, 'repo/public/showcases/service-prototypes/v2/sam-alignment-plate.webp'),
  momentum: path.join(source, 'repo/public/showcases/service-prototypes/v2/sam-momentum-plate.webp'),
  learningPlan: path.join(source, 'live/learning-plan-public.png'),
  decisionFile: path.join(source, 'live/decision-file-empty.png'),
}

const colors = {
  navy: '#121E31',
  deep: '#071522',
  slate: '#2C3E50',
  teal: '#123A45',
  white: '#EAECEE',
  cream: '#F4E9D2',
  bronze: '#8B6914',
  gold: '#D4AF37',
  goldLight: '#F5D060',
}

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrap(value, max) {
  const words = String(value).split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && next.length > max) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function textBlock(lines, x, y, size, color, weight = 600, lineHeight = Math.round(size * 1.18), family = 'Arial, Helvetica, sans-serif') {
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}">${xml(line)}</text>`).join('\n')
}

function baseSvg(width, height, label) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${colors.deep}"/>
        <stop offset="0.55" stop-color="${colors.navy}"/>
        <stop offset="1" stop-color="#17313A"/>
      </linearGradient>
      <pattern id="grain" width="28" height="28" patternUnits="userSpaceOnUse">
        <path d="M0 14 H28 M14 0 V28" stroke="#EAECEE" stroke-opacity="0.025" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <rect width="${width}" height="${height}" fill="url(#grain)"/>
    <rect x="22" y="22" width="${width - 44}" height="${height - 44}" rx="22" fill="none" stroke="${colors.gold}" stroke-opacity="0.78" stroke-width="2"/>
    <text x="58" y="72" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" letter-spacing="4" fill="${colors.goldLight}">${xml(label)}</text>
  </svg>`)
}

async function imageBuffer(file, width, height, fit = 'contain') {
  return sharp(file)
    .resize({ width, height, fit, position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function panelSvg({ maxWidth, title, body = '', light = false }) {
  const layout = await layoutPanel({ title, body, maxWidth })
  const { width, height, titleLines, bodyLines, titleY, bodyY, titleSize, titleLineHeight, bodySize, bodyLineHeight } = layout
  const fill = light ? colors.cream : '#0B2230'
  const titleColor = light ? colors.navy : colors.white
  const bodyColor = light ? colors.slate : '#CBD7DF'
  const input = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="22" fill="${fill}" fill-opacity="0.96" stroke="${colors.gold}" stroke-width="2"/>
    ${textBlock(titleLines, PANEL_PADDING, titleY, titleSize, titleColor, 700, titleLineHeight, 'Georgia, Times New Roman, serif')}
    ${bodyLines.length ? textBlock(bodyLines, PANEL_PADDING, bodyY, bodySize, bodyColor, 500, bodyLineHeight) : ''}
  </svg>`)
  return { input, width, height, layout }
}

async function fittedImage(file, maxWidth, maxHeight, fit = 'contain') {
  const metadata = await sharp(file).metadata()
  if (fit === 'cover') return { input: await imageBuffer(file, maxWidth, maxHeight, fit), width: maxWidth, height: maxHeight }
  const scale = Math.min(maxWidth / metadata.width, maxHeight / metadata.height)
  const width = Math.round(metadata.width * scale)
  const height = Math.round(metadata.height * scale)
  return { input: await imageBuffer(file, width, height, fit), width, height }
}

async function renderSquareSlide({ out, index, total, title, body = '', image, imageFit = 'contain', imageSide = 'right', imageLayout = 'side', eyebrow = 'ACCELERATED', footer = 'amadutown.com/accelerated' }) {
  const canvas = sharp(baseSvg(1080, 1080, `${eyebrow} · ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`)).png()
  const composites = []
  if (image && imageLayout === 'wide') {
    const panel = await panelSvg({ maxWidth: 940, title, body })
    const mediaTop = 125 + panel.height + 22
    const media = await fittedImage(image, 940, 930 - mediaTop, imageFit)
    composites.push({ input: panel.input, left: 70 + Math.round((940 - panel.width) / 2), top: 125 })
    composites.push({ input: media.input, left: 70 + Math.round((940 - media.width) / 2), top: mediaTop })
    const footerSvg = Buffer.from(`<svg width="960" height="80" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="960" y2="2" stroke="${colors.gold}" stroke-width="2"/><text x="0" y="48" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${colors.goldLight}">${xml(footer)}</text><text x="960" y="48" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${colors.white}">ONE DECISION · ONE WORKING FILE</text></svg>`)
    composites.push({ input: footerSvg, left: 60, top: 955 })
    await canvas.composite(composites).png().toFile(out)
    return
  }
  const panel = await panelSvg({ maxWidth: image ? 430 : 880, title, body })
  const panelLeft = imageSide === 'left' && image ? 1010 - panel.width : image ? 70 : Math.round((1080 - panel.width) / 2)
  const panelTop = image ? 130 + Math.round((770 - panel.height) / 2) : Math.round((1080 - panel.height) / 2)
  composites.push({ input: panel.input, left: panelLeft, top: panelTop })
  if (image) {
    const media = await fittedImage(image, 500, 770, imageFit)
    const mediaLaneLeft = imageSide === 'left' ? 55 : 525
    composites.push({ input: media.input, left: mediaLaneLeft + Math.round((500 - media.width) / 2), top: 130 + Math.round((770 - media.height) / 2) })
  }
  const footerSvg = Buffer.from(`<svg width="960" height="80" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="960" y2="2" stroke="${colors.gold}" stroke-width="2"/><text x="0" y="48" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${colors.goldLight}">${xml(footer)}</text><text x="960" y="48" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${colors.white}">ONE DECISION · ONE WORKING FILE</text></svg>`)
  composites.push({ input: footerSvg, left: 60, top: 955 })
  await canvas.composite(composites).png().toFile(out)
}

async function renderVerticalFrame({ out, index, total, title, body = '', image, eyebrow = 'ACCELERATED' }) {
  const canvas = sharp(baseSvg(1080, 1920, `${eyebrow} · ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`)).png()
  const media = image ? await fittedImage(image, 920, 1120, 'contain') : null
  const panel = await panelSvg({ maxWidth: 920, title, body })
  const composites = []
  const groupHeight = (media?.height ?? 0) + (media ? 42 : 0) + panel.height
  const groupTop = 145 + Math.round((1555 - groupHeight) / 2)
  if (media) composites.push({ input: media.input, left: 80 + Math.round((920 - media.width) / 2), top: groupTop })
  composites.push({ input: panel.input, left: 80 + Math.round((920 - panel.width) / 2), top: groupTop + (media?.height ?? 0) + (media ? 42 : 0) })
  const footer = Buffer.from(`<svg width="920" height="110" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="920" y2="2" stroke="${colors.gold}" stroke-width="2"/><text x="0" y="60" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="${colors.goldLight}">amadutown.com/accelerated</text></svg>`)
  composites.push({ input: footer, left: 80, top: 1750 })
  await canvas.composite(composites).png().toFile(out)
}

async function renderWideFrame({ out, index, total, title, body = '', image, imageSide = 'right', eyebrow = 'ACCELERATED · YOUTUBE PROOF' }) {
  const canvas = sharp(baseSvg(1920, 1080, `${eyebrow} · ${String(index).padStart(2, '0')} / ${String(total).padStart(2, '0')}`)).png()
  const panel = await panelSvg({ maxWidth: 730, title, body })
  const media = image ? await fittedImage(image, 970, 800, 'contain') : null
  const composites = []
  if (imageSide === 'left') {
    if (media) composites.push({ input: media.input, left: 80 + Math.round((970 - media.width) / 2), top: 130 + Math.round((800 - media.height) / 2) })
    composites.push({ input: panel.input, left: 1110, top: 130 + Math.round((800 - panel.height) / 2) })
  } else {
    composites.push({ input: panel.input, left: 80, top: 130 + Math.round((800 - panel.height) / 2) })
    if (media) composites.push({ input: media.input, left: 870 + Math.round((970 - media.width) / 2), top: 130 + Math.round((800 - media.height) / 2) })
  }
  const footer = Buffer.from(`<svg width="1760" height="74" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="2" x2="1760" y2="2" stroke="${colors.gold}" stroke-width="2"/><text x="0" y="50" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="${colors.goldLight}">VISUAL ANIMATIC · NO NEW NARRATION</text><text x="1760" y="50" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${colors.white}">amadutown.com/accelerated</text></svg>`)
  composites.push({ input: footer, left: 80, top: 970 })
  await canvas.composite(composites).png().toFile(out)
}

async function renderCarousel(dir, slides) {
  await fs.mkdir(dir, { recursive: true })
  for (let i = 0; i < slides.length; i += 1) {
    await renderSquareSlide({ out: path.join(dir, `slide-${String(i + 1).padStart(2, '0')}.png`), index: i + 1, total: slides.length, ...slides[i] })
  }
}

async function renderVerticalSequence(dir, slides) {
  await fs.mkdir(dir, { recursive: true })
  for (let i = 0; i < slides.length; i += 1) {
    await renderVerticalFrame({ out: path.join(dir, `frame-${String(i + 1).padStart(2, '0')}.png`), index: i + 1, total: slides.length, ...slides[i] })
  }
}

async function renderWideSequence(dir, slides) {
  await fs.mkdir(dir, { recursive: true })
  for (let i = 0; i < slides.length; i += 1) {
    await renderWideFrame({ out: path.join(dir, `frame-${String(i + 1).padStart(2, '0')}.png`), index: i + 1, total: slides.length, ...slides[i] })
  }
}

async function makeContactSheet(files, out, columns = 4, shape = 'square') {
  const cellWidth = shape === 'wide' ? 620 : 420
  const cellHeight = shape === 'wide' ? 360 : 420
  const rows = Math.ceil(files.length / columns)
  const base = sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 4, background: colors.deep } })
  const composites = []
  for (let i = 0; i < files.length; i += 1) {
    const buffer = await imageBuffer(files[i], cellWidth - 20, cellHeight - 20, 'contain')
    composites.push({ input: buffer, left: (i % columns) * cellWidth + 10, top: Math.floor(i / columns) * cellHeight + 10 })
  }
  await base.composite(composites).jpeg({ quality: 92 }).toFile(out)
}

async function makeVideo(files, out, seconds = 3) {
  const manifest = `${files.map((file) => `file '${file.replaceAll("'", "'\\''")}'\nduration ${seconds}`).join('\n')}\nfile '${files.at(-1).replaceAll("'", "'\\''")}'\n`
  const manifestPath = path.join(work, `${path.basename(out)}.txt`)
  await fs.writeFile(manifestPath, manifest)
  await execFileAsync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', manifestPath, '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-movflags', '+faststart', out])
}

async function renderThumbnail() {
  const out = path.join(output, 'youtube-thumbnail-one-decision.png')
  const poster = await imageBuffer(assets.posterL01, 1280, 720, 'cover')
  const label = 'SIGNALS · ALIGNMENT · MOMENTUM'
  const plateWidth = Math.ceil(await measureLine(label, 27, 'Arial, Helvetica, sans-serif', 700) + 2 * PANEL_PADDING + 4)
  const shade = Buffer.from(`<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g"><stop offset="0" stop-color="#071522" stop-opacity="0.05"/><stop offset="1" stop-color="#071522" stop-opacity="0.36"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><rect x="0" y="0" width="650" height="720" fill="#071522"/><rect x="34" y="34" width="1212" height="652" rx="22" fill="none" stroke="${colors.gold}" stroke-width="3"/><text x="72" y="92" font-family="Arial" font-size="24" font-weight="700" letter-spacing="5" fill="${colors.goldLight}">ACCELERATED</text>${textBlock(['ONE DECISION.', 'ONE WORKING FILE.'], 72, 205, 58, colors.white, 800, 74)}<rect x="72" y="430" width="${plateWidth}" height="88" rx="16" fill="#0B2230" fill-opacity="0.94" stroke="${colors.gold}" stroke-width="2"/><text x="${72 + PANEL_PADDING}" y="488" font-family="Arial" font-size="27" font-weight="700" fill="${colors.goldLight}">SIGNALS · ALIGNMENT · MOMENTUM</text><text x="72" y="628" font-family="Arial" font-size="26" font-weight="700" fill="${colors.white}">amadutown.com/accelerated</text></svg>`)
  await sharp(poster).composite([{ input: shade }]).png().toFile(out)
  return out
}

async function reviewBoard(input, label) {
  const out = path.join(work, `review-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`)
  const image = await imageBuffer(input, 1460, 850, 'contain')
  const base = sharp(baseSvg(1920, 1080, `REVIEW · ${label}`)).png()
  const caption = Buffer.from(`<svg width="340" height="720" xmlns="http://www.w3.org/2000/svg"><rect width="340" height="720" rx="22" fill="#0B2230" stroke="${colors.gold}" stroke-width="2"/>${textBlock(wrap(label, 18), 30, 90, 40, colors.white, 700, 50, 'Georgia, serif')}<text x="30" y="650" font-family="Arial" font-size="20" fill="${colors.goldLight}">SOURCE-BOUND</text><text x="30" y="685" font-family="Arial" font-size="17" fill="${colors.white}">INTERNAL REVIEW ONLY</text></svg>`)
  await base.composite([{ input: image, left: 430, top: 120 }, { input: caption, left: 60, top: 180 }]).png().toFile(out)
  return out
}

async function mobileReviewComposition(input, out, label) {
  const slide = await imageBuffer(input, 390, 390, 'contain')
  const header = Buffer.from(`<svg width="390" height="844" xmlns="http://www.w3.org/2000/svg"><rect width="390" height="844" fill="${colors.deep}"/><rect x="12" y="12" width="366" height="820" rx="18" fill="none" stroke="${colors.gold}" stroke-opacity="0.7"/><text x="28" y="54" font-family="Arial" font-size="16" font-weight="700" letter-spacing="2" fill="${colors.goldLight}">ACCELERATED · REVIEW</text><text x="28" y="530" font-family="Arial" font-size="16" font-weight="700" fill="${colors.white}">${xml(label)}</text><line x1="28" y1="557" x2="362" y2="557" stroke="${colors.gold}"/><text x="28" y="595" font-family="Arial" font-size="14" fill="${colors.white}">390 × 844 target-size composition</text><text x="28" y="785" font-family="Arial" font-size="14" fill="${colors.goldLight}">INTERNAL REVIEW ONLY</text></svg>`)
  await sharp(header).composite([{ input: slide, left: 0, top: 108 }]).png().toFile(out)
}

async function comparisonBoard(before, after, out, label) {
  const oldImage = await fittedImage(before, 850, 790)
  const newImage = await fittedImage(after, 850, 790)
  const canvas = sharp(baseSvg(1920, 1080, `CONTENT FIT · ${label}`)).png()
  const captions = Buffer.from(`<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg"><text x="80" y="150" font-family="Arial" font-size="28" font-weight="700" fill="${colors.white}">SOURCE REVIEW</text><text x="1000" y="150" font-family="Arial" font-size="28" font-weight="700" fill="${colors.goldLight}">CONTENT FIT REVIEW</text></svg>`)
  await canvas.composite([
    { input: oldImage.input, left: 80 + Math.round((850 - oldImage.width) / 2), top: 180 + Math.round((790 - oldImage.height) / 2) },
    { input: newImage.input, left: 1000 + Math.round((850 - newImage.width) / 2), top: 180 + Math.round((790 - newImage.height) / 2) },
    { input: captions },
  ]).png().toFile(out)
}

async function mobileReviewBoard(files, out) {
  const images = await Promise.all(files.map((file) => imageBuffer(file, 390, 844, 'contain')))
  const canvas = sharp(baseSvg(1920, 1080, 'CONTENT FIT · 390 × 844 TARGET SIZE')).png()
  await canvas.composite(images.map((input, index) => ({ input, left: 210 + index * 560, top: 130 }))).png().toFile(out)
}

async function main() {
  const sourceBindings = await verifySourceBindings(root)
  await fs.rm(output, { recursive: true, force: true })
  await fs.rm(work, { recursive: true, force: true })
  await fs.mkdir(output, { recursive: true })
  await fs.mkdir(work, { recursive: true })

  const teaseSlides = [
    { title: 'Faster output can still leave the decision behind.', body: 'A full board can hide an unclear choice.', image: assets.posterL01, imageLayout: 'wide' },
    { title: 'The brief arrived. The roadmap arrived. The customer message arrived.', body: 'More material entered the room.', image: assets.learningPlan, imageLayout: 'wide' },
    { title: 'The choice was still unclear.', body: 'Start with the decision the team must make.', image: assets.framework, imageLayout: 'wide' },
    { title: 'Signals', body: 'What evidence would change the choice?', image: assets.signals },
    { title: 'Alignment', body: 'Who owns the decision and its tradeoffs?', image: assets.alignment, imageSide: 'left' },
    { title: 'Momentum', body: 'What will the team test and learn next?', image: assets.momentum },
    { title: 'Carry the work in one Decision File.', body: 'Keep the evidence, tradeoffs, owner, and next move together.', image: assets.decisionFile, imageLayout: 'wide' },
    { title: 'One decision. One guided path. One working file.', body: 'Start at amadutown.com/accelerated', image: assets.posterL12, imageLayout: 'wide' },
  ]

  const proofSlides = [
    { title: 'What you carry through all 16 lessons', body: 'The work stays connected from the first question to the next learning loop.', image: assets.learningPlan, imageLayout: 'wide' },
    { title: 'One decision worth making responsibly.', image: assets.posterL01, imageLayout: 'wide' },
    { title: 'The questions underneath it.', image: assets.signals },
    { title: 'The evidence that could change it.', image: assets.signals, imageSide: 'left' },
    { title: 'The tradeoffs the team has to own.', image: assets.alignment },
    { title: 'The person responsible for the next move.', image: assets.alignment, imageSide: 'left' },
    { title: 'The review date that keeps the learning alive.', image: assets.momentum },
    { title: 'The Decision File keeps the path together.', body: 'Inspect the public learning system before you begin.', image: assets.decisionFile, imageLayout: 'wide' },
  ]

  const toolSlides = [
    { title: 'Four questions before adding another AI tool', body: 'A tool becomes useful when the team knows what decision it serves.', image: assets.framework, imageLayout: 'wide' },
    { title: 'What decision must improve?', image: assets.posterL01, imageLayout: 'wide' },
    { title: 'What evidence could change that decision?', image: assets.signals },
    { title: 'Who owns the choice and its tradeoffs?', image: assets.alignment },
    { title: 'What will the team test and learn next?', image: assets.momentum },
    { title: 'A new tool should support this path.', body: 'Keep evidence, ownership, and judgment in the work.', image: assets.framework, imageLayout: 'wide' },
    { title: 'Signals. Alignment. Momentum.', image: assets.framework, imageLayout: 'wide' },
    { title: 'Bring one decision.', body: 'Start at amadutown.com/accelerated', image: assets.posterL12, imageLayout: 'wide' },
  ]

  const carouselTease = path.join(output, 'carousel-faster-output')
  const carouselProof = path.join(output, 'carousel-decision-file')
  const carouselTools = path.join(output, 'carousel-four-questions')
  await renderCarousel(carouselTease, teaseSlides)
  await renderCarousel(carouselProof, proofSlides)
  await renderCarousel(carouselTools, toolSlides)

  const shortOne = [
    { title: 'Start with one decision.', image: assets.posterL01 },
    { title: 'What evidence would change it?', image: assets.signals },
    { title: 'Who owns the tradeoff?', image: assets.alignment },
    { title: 'What will the team learn next?', image: assets.momentum },
    { title: 'Signals. Alignment. Momentum.', image: assets.framework },
  ]
  const shortHuman = [
    { title: 'AI can prepare the work.', image: assets.signals },
    { title: 'People still own the choice.', image: assets.posterL01 },
    { title: 'Evidence. Tradeoffs. Ownership. Learning.', image: assets.framework },
    { title: 'Keep human judgment in the room.', image: assets.posterL12 },
  ]
  const shortOneDir = path.join(output, 'short-start-with-one-decision')
  const shortHumanDir = path.join(output, 'short-people-own-the-choice')
  await renderVerticalSequence(shortOneDir, shortOne)
  await renderVerticalSequence(shortHumanDir, shortHuman)

  const proofEpisode = [
    { title: 'From AI output to a responsible product decision', body: 'The board can be full while the decision stays unclear.', image: assets.posterL01 },
    { title: 'The crowded board', body: 'Start by naming the decision the team must make.', image: assets.learningPlan, imageSide: 'left' },
    { title: 'Signals', body: 'Turn noise into evidence the team can test.', image: assets.signals },
    { title: 'Alignment', body: 'Name the tradeoffs, owner, and outcome.', image: assets.alignment, imageSide: 'left' },
    { title: 'Momentum', body: 'Define the next test and the next review point.', image: assets.momentum },
    { title: 'The Decision File', body: 'Keep the questions, evidence, tradeoffs, owner, and next move together.', image: assets.decisionFile, imageSide: 'left' },
    { title: 'Bring one decision that matters.', body: 'Follow the guided path. Keep human judgment in the room.', image: assets.posterL12 },
  ]
  const proofDir = path.join(output, 'youtube-proof-animatic')
  await renderWideSequence(proofDir, proofEpisode)

  const thumbnail = await renderThumbnail()

  const teaseFiles = (await fs.readdir(carouselTease)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(carouselTease, f))
  const proofFiles = (await fs.readdir(carouselProof)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(carouselProof, f))
  const toolsFiles = (await fs.readdir(carouselTools)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(carouselTools, f))
  const shortOneFiles = (await fs.readdir(shortOneDir)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(shortOneDir, f))
  const shortHumanFiles = (await fs.readdir(shortHumanDir)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(shortHumanDir, f))
  const proofEpisodeFiles = (await fs.readdir(proofDir)).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(proofDir, f))

  const contacts = [
    [teaseFiles, path.join(output, 'contact-carousel-faster-output.jpg')],
    [proofFiles, path.join(output, 'contact-carousel-decision-file.jpg')],
    [toolsFiles, path.join(output, 'contact-carousel-four-questions.jpg')],
    [shortOneFiles, path.join(output, 'contact-short-start-with-one-decision.jpg'), 3],
    [shortHumanFiles, path.join(output, 'contact-short-people-own-the-choice.jpg'), 2],
    [proofEpisodeFiles, path.join(output, 'contact-youtube-proof.jpg'), 3, 'wide'],
  ]
  for (const [files, out, columns, shape] of contacts) await makeContactSheet(files, out, columns ?? 4, shape)

  const mobileDir = path.join(output, 'mobile-390x844')
  await fs.mkdir(mobileDir, { recursive: true })
  const mobileFiles = []
  for (const [name, files] of [['faster-output', teaseFiles], ['decision-file', proofFiles], ['four-questions', toolsFiles]]) {
    for (let i = 0; i < files.length; i += 1) {
      const out = path.join(mobileDir, `${name}-${String(i + 1).padStart(2, '0')}.png`)
      await mobileReviewComposition(files[i], out, `${name.replaceAll('-', ' ')} · ${String(i + 1).padStart(2, '0')} / ${String(files.length).padStart(2, '0')}`)
      mobileFiles.push(out)
    }
  }

  const shortOneVideo = path.join(output, 'short-start-with-one-decision-visual.mp4')
  const shortHumanVideo = path.join(output, 'short-people-own-the-choice-visual.mp4')
  const proofVideo = path.join(output, 'youtube-proof-visual-animatic.mp4')
  await makeVideo(shortOneFiles, shortOneVideo, 3)
  await makeVideo(shortHumanFiles, shortHumanVideo, 3)
  await makeVideo(proofEpisodeFiles, proofVideo, 5)

  const reviewInputs = [
    [path.join(output, 'contact-carousel-faster-output.jpg'), 'Carousel · Faster output'],
    [path.join(output, 'contact-carousel-decision-file.jpg'), 'Carousel · Decision File'],
    [path.join(output, 'contact-carousel-four-questions.jpg'), 'Carousel · Four questions'],
    [path.join(output, 'contact-short-start-with-one-decision.jpg'), 'Short · Start with one decision'],
    [path.join(output, 'contact-short-people-own-the-choice.jpg'), 'Short · People own the choice'],
    [path.join(output, 'contact-youtube-proof.jpg'), 'YouTube proof · All frames'],
    [thumbnail, 'YouTube thumbnail'],
    [proofEpisodeFiles[2], 'YouTube proof · Signals'],
    [proofEpisodeFiles[5], 'YouTube proof · Decision File'],
  ]
  const reviewBoards = []
  for (const [input, label] of reviewInputs) reviewBoards.push(await reviewBoard(input, label))
  for (const [before, after, label] of [
    ['carousel-faster-output/slide-04.png', 'carousel-faster-output/slide-04.png', 'SQUARE PLATE'],
    ['short-start-with-one-decision/frame-01.png', 'short-start-with-one-decision/frame-01.png', 'VERTICAL PLATE'],
    ['youtube-proof-animatic/frame-03.png', 'youtube-proof-animatic/frame-03.png', 'WIDE PLATE'],
  ]) {
    const out = path.join(output, `comparison-${label.toLowerCase().replaceAll(' ', '-')}.png`)
    await comparisonBoard(path.join(root, 'review-assets', before), path.join(output, after), out, label)
    reviewBoards.push(out)
  }
  const mobileBoard = path.join(output, 'review-mobile-390x844.png')
  await mobileReviewBoard([mobileFiles[3], mobileFiles[8], mobileFiles[16]], mobileBoard)
  reviewBoards.push(mobileBoard)
  const walkthrough = path.join(output, 'accelerated-campaign-visual-review-walkthrough.mp4')
  await makeVideo(reviewBoards, walkthrough, 4)

  const finalFiles = [
    ...teaseFiles,
    ...proofFiles,
    ...toolsFiles,
    ...shortOneFiles,
    ...shortHumanFiles,
    ...proofEpisodeFiles,
    ...contacts.map(([, out]) => out),
    ...mobileFiles,
    ...reviewBoards.filter((file) => file.startsWith(output)),
    thumbnail,
    shortOneVideo,
    shortHumanVideo,
    proofVideo,
    walkthrough,
  ]
  const receipts = []
  for (const file of finalFiles) receipts.push({ path: path.relative(process.cwd(), file), sha256: await sha256(file) })
  await fs.writeFile(path.join(root, 'render-receipt-content-fit.json'), `${JSON.stringify({
    version: 'accelerated_campaign_visual_review_content_fit_v2',
    prepared: '2026-11-18',
    campaign_id: 'b160eab6-1a5a-478d-954a-ca59a3a10e34',
    visual_source_manifest_sha256: manifestHash,
    original_generator_sha256: ORIGINAL_GENERATOR_SHA256,
    original_render_receipt_sha256: ORIGINAL_RENDER_RECEIPT_SHA256,
    source_bindings: sourceBindings,
    side_effects: { provider_calls: false, spend: false, upload: false, schedule: false, publish: false, post: false, outreach_send: false },
    public_captures: ['https://amadutown.com/accelerated/learningplan', 'https://amadutown.com/accelerated/decision-file'],
    public_captures_reused_without_network: true,
    outputs: receipts,
  }, null, 2)}\n`)
  console.log(JSON.stringify({ output, walkthrough, proofVideo, thumbnail, files: finalFiles.length }, null, 2))
}

await main()
