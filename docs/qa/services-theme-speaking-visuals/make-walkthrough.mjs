import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.dirname(new URL(import.meta.url).pathname);
const slides = [
  ['desktop-dark-catalog.png', 'Dark catalog: Speaking filter and primary action'],
  ['desktop-dark-speaking-qa.png', 'Gallery: distinct illustrative Q&A scene'],
  ['desktop-light-catalog.png', 'Light catalog: controls and card contrast'],
  ['tablet-light-catalog.png', 'Tablet catalog: filters and card layout'],
  ['mobile-light-catalog.png', 'Mobile light: complete Speaking card'],
  ['mobile-dark-catalog.png', 'Mobile dark: complete Speaking card'],
  ['mobile-dark-detail.png', 'Mobile detail: image, metadata, and action'],
  ['tablet-light-detail.png', 'Tablet detail: light theme layout'],
  ['desktop-light-detail-qa.png', 'Detail gallery: second illustrative scene'],
];
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'services-qa-'));
try {
  const frames = [];
  for (const [index, [file, caption]] of slides.entries()) {
    const input = path.join(root, file);
    const source = sharp(input);
    const metadata = await source.metadata();
    const panels = [];
    if (metadata.width < 500) {
      const panelHeight = Math.min(620, metadata.height);
      for (const [left, top] of [[190, 0], [690, metadata.height - panelHeight]]) {
        const crop = await sharp(input)
          .extract({ left: 0, top, width: metadata.width, height: panelHeight })
          .resize({ height: 620 })
          .toBuffer();
        panels.push({ input: crop, left, top: 76 });
      }
    } else {
      const pixels = await source.resize(1280, 650, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
      panels.push({ input: pixels.data, left: Math.floor((1280 - pixels.info.width) / 2), top: 56 + Math.floor((664 - pixels.info.height) / 2) });
    }
    const safeCaption = caption.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
    const title = Buffer.from(`<svg width="1280" height="56" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="56" fill="#142039"/><text x="40" y="38" fill="#ffffff" font-family="Arial,sans-serif" font-size="27">${safeCaption}</text></svg>`);
    const output = path.join(temp, `frame-${String(index).padStart(2, '0')}.png`);
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#142039' } })
      .composite([
        ...panels,
        { input: title, left: 0, top: 0 },
      ])
      .png()
      .toFile(output);
    frames.push(output);
  }
  const list = path.join(temp, 'frames.ffconcat');
  await fs.writeFile(list, ['ffconcat version 1.0', ...frames.flatMap(frame => [`file '${frame}'`, 'duration 2.5']), `file '${frames.at(-1)}'`].join('\n'));
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', list, '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-crf', '21', '-movflags', '+faststart', path.join(root, 'services-speaking-walkthrough.mp4')], { stdio: 'inherit' });
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
