import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.dirname(new URL(import.meta.url).pathname);
const slides = [
  ['desktop-dark-workshops.png', 'Workshop filter: three typed workshop offers, dark theme'],
  ['desktop-light-workshops.png', 'Workshop search: five named offers, light theme'],
  ['desktop-light-cohort-secondary.png', 'Cohort gallery: second laptop exercise scene'],
  ['desktop-dark-management-hero.png', 'Management Consulting: private one-on-one hero'],
  ['desktop-dark-management-secondary.png', 'Management Consulting: distinct private follow-up scene'],
  ['desktop-dark-data-migration-secondary.png', 'Data Migration: offer-specific second working scene'],
  ['tablet-light-workshops.png', 'Tablet, 820 px: workshop cards and actions'],
  ['mobile-dark-cohort-secondary.png', 'Mobile, 390 px: gallery, labels, and quote action'],
  ['mobile-dark-cohort-detail.png', 'Mobile detail: workshop image and deliverables'],
];

const escapeXml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'services-consulting-workshop-qa-'));
try {
  const frames = [];
  for (const [index, [file, caption]] of slides.entries()) {
    const input = path.join(root, file);
    const metadata = await sharp(input).metadata();
    const panels = [];
    if (metadata.width < 500) {
      const panelHeight = Math.min(620, metadata.height);
      for (const [left, top] of [[190, 0], [690, metadata.height - panelHeight]]) {
        const crop = await sharp(input)
          .extract({ left: 0, top, width: metadata.width, height: panelHeight })
          .resize({ height: 620 })
          .toBuffer();
        panels.push({ input: crop, left, top: 72 });
      }
    } else {
      const pixels = await sharp(input).resize(1280, 648, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
      panels.push({ input: pixels.data, left: Math.floor((1280 - pixels.info.width) / 2), top: 72 + Math.floor((648 - pixels.info.height) / 2) });
    }
    const title = Buffer.from(`<svg width="1280" height="72" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="72" fill="#142039"/><text x="36" y="33" fill="#ffffff" font-family="Arial,sans-serif" font-size="25">${escapeXml(caption)}</text><text x="36" y="57" fill="#b9c9df" font-family="Arial,sans-serif" font-size="16">localhost:3037/services · product commit d8c11d95878beaa1b67f925d86dc5f70773615c3 · illustrative scenes</text></svg>`);
    const frame = path.join(temp, `frame-${String(index).padStart(2, '0')}.png`);
    await sharp({ create: { width: 1280, height: 720, channels: 4, background: '#142039' } })
      .composite([...panels, { input: title, left: 0, top: 0 }])
      .png()
      .toFile(frame);
    frames.push(frame);
  }
  const list = path.join(temp, 'frames.ffconcat');
  await fs.writeFile(list, ['ffconcat version 1.0', ...frames.flatMap(frame => [`file '${frame}'`, 'duration 2.8']), `file '${frames.at(-1)}'`].join('\n'));
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-safe', '0', '-f', 'concat', '-i', list, '-vf', 'fps=24,format=yuv420p', '-c:v', 'libx264', '-crf', '21', '-movflags', '+faststart', path.join(root, 'services-consulting-workshop-walkthrough.mp4')], { stdio: 'inherit' });
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
