import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
const mapPath = path.join(qa, 'source-to-service-visual-map.json')
const map = JSON.parse(await fs.readFile(mapPath, 'utf8'))
const sourceImage = path.join(root, 'agentified/source-assets/accelerated/accelerated-sam-infographic.png')
const hash = async (file) => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const titles = {
  'ai-strategy-half-day:hero': ['The Full', 'Discovery Loop'],
  'ai-strategy-half-day:secondary': ['Roadmap Bets'],
  'ai-strategy-full-day:hero': ['Decision Theater'],
  'ai-strategy-full-day:secondary': ['Metrics Ladder'],
  'ai-strategy-recorded:hero': ['Signals · Alignment', '· Momentum'],
  'ai-strategy-recorded:secondary': ['Learning Plan'],
  'accelerated-cohort-workshop:hero': ['Accelerated', 'SAM System'],
  'accelerated-cohort-workshop:secondary': ['Learning Roadmap'],
  'product-innovation-workshop:hero': ['Jobs from Noise'],
  'product-innovation-workshop:secondary': ['VisionScope +', 'MarketCraft'],
}
const photoCrops = {
  'ai-strategy-half-day:hero': { left: 0, top: 0, width: 1000, height: 667 },
  'ai-strategy-half-day:secondary': { left: 0, top: 0, width: 1000, height: 667 },
  'ai-strategy-full-day:hero': { left: 500, top: 100, width: 900, height: 600 },
  'ai-strategy-full-day:secondary': { left: 0, top: 0, width: 1536, height: 1024 },
  'ai-strategy-recorded:hero': { left: 0, top: 0, width: 1200, height: 800 },
  'ai-strategy-recorded:secondary': { left: 0, top: 0, width: 850, height: 567 },
  'accelerated-cohort-workshop:hero': { left: 0, top: 0, width: 1000, height: 667 },
  'accelerated-cohort-workshop:secondary': { left: 0, top: 0, width: 1000, height: 667 },
  'product-innovation-workshop:hero': { left: 0, top: 0, width: 1000, height: 667 },
  'product-innovation-workshop:secondary': { left: 0, top: 0, width: 1536, height: 1024 },
}
function text(x, y, value, size, weight = 700, fill = '#22313c') {
  return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${escape(value)}</text>`
}
function artwork(row, key) {
  const title = titles[key]
  const labels = row.visibleLabels
  const sam = row.source.endsWith('accelerated-sam-infographic.png')
  const left = 770, top = 90, width = 690, height = 844
  let body = ''
  if (sam) {
    body = `<rect x="810" y="280" width="610" height="500" rx="9" fill="#142039"/>`
    body += labels.map((label, i) => `<rect x="${810 + i * 205}" y="805" width="190" height="95" rx="9" fill="${i % 2 ? '#e6ede7' : '#efe8dd'}"/>${text(824 + i * 205, 865, label, label.length > 8 ? 26 : 30)}`).join('')
  } else if (labels.length === 6) {
    body = labels.map((label, i) => {
      const col = i % 2, rowNum = Math.floor(i / 2), x = 805 + col * 315, y = 285 + rowNum * 190
      const size = label.length > 15 ? 28 : 34
      return `<rect x="${x}" y="${y}" width="300" height="160" rx="11" fill="${(col + rowNum) % 2 ? '#e6ede7' : '#efe8dd'}"/>${text(x + 21, y + 96, label, size)}`
    }).join('')
  } else {
    const firstY = title.length > 1 ? 290 : 255
    const available = 900 - firstY
    const step = Math.floor(available / labels.length)
    body = labels.map((label, i) => {
      const y = firstY + i * step
      const size = Math.min(46, Math.floor(575 / (label.length * .61)))
      return `<rect x="805" y="${y}" width="615" height="${step - 16}" rx="11" fill="${i % 2 ? '#e6ede7' : '#efe8dd'}"/>${text(839, y + Math.min(72, step - 43), label, size)}`
    }).join('')
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024"><defs><linearGradient id="fade" x1="0" x2="1536" y1="0" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#0f1820" stop-opacity="0"/><stop offset="43%" stop-color="#0f1820" stop-opacity="0"/><stop offset="100%" stop-color="#0f1820" stop-opacity=".3"/></linearGradient></defs><rect width="1536" height="1024" fill="url(#fade)"/><rect x="${left+18}" y="${top+22}" width="${width}" height="${height}" rx="27" fill="#13202a" fill-opacity=".17"/><rect x="${left+9}" y="${top+11}" width="${width}" height="${height}" rx="27" fill="#13202a" fill-opacity=".11"/><rect x="${left}" y="${top}" width="${width}" height="${height}" rx="27" fill="#f8f6f0"/><rect x="${left+31}" y="${top+37}" width="89" height="7" rx="3" fill="#ae955e"/>${title.map((line, i) => text(804, 196 + i * 66, line, line.length > 18 ? 47 : 57)).join('')}${body}</svg>`
}
const sourceHashes = {
  'accelerated_ebook_leadmagnet.epub': await hash(path.join(root, 'accelerated_ebook_leadmagnet.epub')),
  'agentified/source-assets/accelerated/accelerated-sam-infographic.png': await hash(sourceImage),
}
for (const row of map.frames) {
  const key = `${row.slug}:${row.role}`
  if (!titles[key]) throw new Error(`No title for ${key}`)
  const crop = photoCrops[key]
  if (!crop) throw new Error(`No photo crop for ${key}`)
  const file = `${row.slug}-${row.role}`
  const artifactPath = path.join(qa, 'source-artifacts', `${file}.svg`)
  await fs.writeFile(artifactPath, artwork(row, key) + '\n')
  const base = path.join(qa, 'base-natural-color', `${file}.jpg`)
  const output = path.join(root, 'public/showcases/service-photographic', `${file}.jpg`)
  const composites = [{ input: await sharp(artifactPath).png().toBuffer(), left: 0, top: 0 }]
  if (row.source === 'agentified/source-assets/accelerated/accelerated-sam-infographic.png') {
    const sourcePixels = await sharp(sourceImage).resize(600, 490, { fit: 'contain', background: '#142039' }).png().toBuffer()
    composites.push({ input: sourcePixels, left: 815, top: 285 })
  }
  await sharp(base).extract(crop).resize(1536, 1024).composite(composites).jpeg({ quality: 91, mozjpeg: true }).toFile(output + '.tmp')
  await fs.rename(output + '.tmp', output)
  row.sourceSha256 = sourceHashes[row.source]
  row.artifactPath = path.relative(root, artifactPath)
  row.artifactSha256 = await hash(artifactPath)
  row.basePhotoPath = path.relative(root, base)
  row.basePhotoSha256 = await hash(base)
  row.compositeMethod = `sharp full-bleed natural photo crop ${JSON.stringify(crop)} resized to 1536x1024 with right layered source-derived callout, gradient transition, shadow, and 690x844 panel${row.source.endsWith('.png') ? '; owned SAM infographic pixels copied into panel' : ''}`
  row.outputPath = path.relative(root, output)
  row.outputSha256 = await hash(output)
  row.placement = 'layered editorial source callout on full-bleed photo'
}
await fs.writeFile(mapPath, JSON.stringify(map, null, 2) + '\n')
