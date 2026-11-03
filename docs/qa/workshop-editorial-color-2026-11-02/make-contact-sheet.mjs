import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const qa = path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02')
const matrix = JSON.parse(await fs.readFile(path.join(root, 'docs/qa/services-theme-speaking-visuals/workshop-casting-matrix.json'), 'utf8'))
const w = 480, h = 320, label = 38, pad = 12
const width = 2 * w + 3 * pad, height = 5 * (h + label) + 6 * pad
const parts = []
for (const [i, asset] of matrix.assets.entries()) {
  const x = pad + (i % 2) * (w + pad)
  const y = pad + Math.floor(i / 2) * (h + label + pad)
  parts.push({ input: await sharp(path.join(root, 'public', asset.imageUrl)).resize(w, h, { fit: 'cover' }).jpeg({ quality: 88 }).toBuffer(), left: x, top: y })
  const title = `${asset.slug} · ${asset.role}`.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  parts.push({ input: Buffer.from(`<svg width="${w}" height="${label}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f5f3ee"/><text x="8" y="25" font-family="Arial" font-size="19" fill="#162637">${title}</text></svg>`), left: x, top: y + h })
}
const out = path.join(qa, 'contact-sheet.jpg')
await sharp({ create: { width, height, channels: 3, background: '#e7e4dc' } }).composite(parts).jpeg({ quality: 90 }).toFile(out + '.tmp')
await fs.rename(out + '.tmp', out)
