import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'

const root = path.dirname(new URL(import.meta.url).pathname)
const slides = [
  ['desktop-light-hero.png', 'Five workshop offers · source material in the room · light desktop', 'top'],
  ['desktop-light-hero.png', 'Workshop scenes · faces and collaboration remain visible', 'bottom'],
  ['desktop-light-secondary.png', 'Book excerpts and original SAM infographic · light desktop', 'top'],
  ['desktop-dark-secondary.png', 'Book excerpts and original SAM infographic · dark desktop', 'bottom'],
  ['tablet-light-secondary.png', 'Tablet 820 px · light · second scenes', 'top'],
  ['tablet-dark-secondary.png', 'Tablet 820 px · dark · second scenes', 'bottom'],
  ['mobile-light-hero.png', 'Mobile 390 px · light · hero scenes', 'top'],
  ['mobile-light-secondary.png', 'Mobile 390 px · light · second scenes', 'bottom'],
  ['mobile-dark-secondary.png', 'Mobile 390 px · dark · second scenes', 'top'],
  ['mobile-light-full-day-detail-hero.png', 'Mobile Full-Day detail · working groups', 'top'],
  ['mobile-light-full-day-detail-secondary.png', 'Mobile Full-Day detail · synthesis', 'top'],
  ['desktop-light-full-day-detail-secondary.png', 'Desktop Full-Day detail · synthesis', 'top'],
]
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'workshop-editorial-color-qa-'))
try {
  const frames = []
  for (const [index, [name, caption, cropPosition]] of slides.entries()) {
    const input = path.join(root, name)
    const meta = await sharp(input).metadata()
    let image
    if (meta.width < 500) {
      const height = Math.min(meta.height, 430)
      const top = cropPosition === 'bottom'
        ? meta.height - height
        : Math.min(meta.height - height, name.includes('detail') ? 220 : 360)
      image = await sharp(input).extract({ left: 0, top, width: meta.width, height }).resize({ height: 615 }).toBuffer({ resolveWithObject: true })
    } else {
      const height = Math.min(meta.height, 760)
      const top = cropPosition === 'bottom' ? meta.height - height : 0
      image = await sharp(input).extract({ left: 0, top, width: meta.width, height }).resize(1240, 615, { fit: 'inside' }).toBuffer({ resolveWithObject: true })
    }
    const title = Buffer.from(`<svg width="1280" height="80" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="80" fill="#142039"/><text x="30" y="34" fill="#fff" font-family="Arial,sans-serif" font-size="25">${escapeXml(caption)}</text><text x="30" y="61" fill="#becbe0" font-family="Arial,sans-serif" font-size="15">localhost:3212 · product commit 99e711c4 · illustrative scenes · public catalog snapshot</text></svg>`)
    const frame = path.join(temp, `frame-${String(index).padStart(2, '0')}.png`)
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#142039' } })
      .composite([{ input: image.data, left: Math.floor((1280 - image.info.width) / 2), top: 87 + Math.floor((615 - image.info.height) / 2) }, { input: title, left: 0, top: 0 }])
      .png().toFile(frame)
    frames.push(frame)
  }
  const list = path.join(temp, 'frames.ffconcat')
  await fs.writeFile(list, ['ffconcat version 1.0', ...frames.flatMap((frame) => [`file '${frame}'`, 'duration 2.5']), `file '${frames.at(-1)}'`].join('\n'))
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', list, '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-crf', '20', '-movflags', '+faststart', path.join(root, 'workshop-editorial-color-walkthrough-99e711c4.mp4')], { stdio: 'inherit' })
  if (result.status !== 0) process.exitCode = result.status || 1
} finally {
  await fs.rm(temp, { recursive: true, force: true })
}
