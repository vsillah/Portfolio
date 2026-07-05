#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);

function loadSharp() {
  try {
    return require('sharp');
  } catch (error) {
    const fallback = process.env.PORTFOLIO_NODE_MODULES
      ? path.join(process.env.PORTFOLIO_NODE_MODULES, 'sharp')
      : path.resolve(root, '../../../Portfolio/node_modules/sharp');
    try {
      return require(fallback);
    } catch {
      throw error;
    }
  }
}

const sharp = loadSharp();
const defaultBase = path.join(root, 'source-assets/illustration-bases/figure-3-amina-inside-sam-base.png');
const outDir = path.join(root, 'manuscript/visuals/rendered/publication-plates');
const defaultOut = path.join(outDir, 'figure-3-amina-inside-sam-publication-plate.png');

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const basePath = path.resolve(argValue('--base') ?? defaultBase);
const outPath = path.resolve(argValue('--out') ?? defaultOut);
const placeholder = process.argv.includes('--placeholder');

const width = 3600;
const height = 4500;

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text({ x, y, value, size, weight = 700, fill = '#f2d36f', anchor = 'middle', style = '' }) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" style="${style}">${escapeXml(value)}</text>`;
}

function chamferedPath({ x, y, w, h, cut = 36 }) {
  return [
    `M ${x + cut} ${y}`,
    `L ${x + w - cut} ${y}`,
    `L ${x + w} ${y + h / 2}`,
    `L ${x + w - cut} ${y + h}`,
    `L ${x + cut} ${y + h}`,
    `L ${x} ${y + h / 2}`,
    'Z',
  ].join(' ');
}

function labelBox({ x, y, w, h, title, subtitle }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 42 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="7" opacity="0.9"/>
    <path d="${chamferedPath({ x: x + 18, y: y + 18, w: w - 36, h: h - 36, cut: 26 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.35" stroke-width="3"/>
    <path d="M ${x + 80} ${y + h - 30} C ${x + w * 0.35} ${y + h - 12}, ${x + w * 0.65} ${y + h - 12}, ${x + w - 80} ${y + h - 30}" fill="none" stroke="#f3d77e" stroke-opacity="0.22" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + 78, value: title, size: 52, weight: 850, fill: '#fff7e8' })}
    ${text({ x: x + w / 2, y: y + 124, value: subtitle, size: 27, weight: 650, fill: '#f2d36f' })}
  `;
}

function aminaCell({ x, y, letter, title, subtitle, fill = '#fbf7ee', titleSize = 54 }) {
  const points = [
    [x + 92, y],
    [x + 276, y],
    [x + 368, y + 155],
    [x + 276, y + 310],
    [x + 92, y + 310],
    [x, y + 155],
  ].map(([px, py]) => `${px},${py}`).join(' ');

  return `
    <polygon points="${points}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="9" opacity="0.88"/>
    <polygon points="${points}" fill="none" stroke="#f3d77e" stroke-opacity="0.32" stroke-width="3" transform="translate(0 0) scale(0.94)" transform-origin="${x + 184} ${y + 155}"/>
    <circle cx="${x + 184}" cy="${y + 110}" r="58" fill="url(#navyMedallion)" stroke="#c99c35" stroke-width="8"/>
    ${text({ x: x + 184, y: y + 130, value: letter, size: 66, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + 184, y: y + 215, value: title, size: titleSize, weight: 900, fill: '#fff7e8' })}
    ${text({ x: x + 184, y: y + 262, value: subtitle, size: 30, weight: 700, fill: '#f2d36f', style: 'font-style: italic;' })}
  `;
}

function receiptCard({ x, y, title, subtitle }) {
  return `
    <path d="${chamferedPath({ x, y, w: 660, h: 178, cut: 34 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="8" opacity="0.9"/>
    <path d="${chamferedPath({ x: x + 18, y: y + 18, w: 624, h: 142, cut: 23 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.34" stroke-width="3"/>
    ${text({ x: x + 330, y: y + 78, value: title, size: 70, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + 330, y: y + 132, value: subtitle, size: 30, weight: 700, fill: '#fff7e8' })}
  `;
}

function overlaySvg() {
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
      <linearGradient id="darkPlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#182338"/>
        <stop offset="0.48" stop-color="#0c1628"/>
        <stop offset="1" stop-color="#253143"/>
      </linearGradient>
      <radialGradient id="navyMedallion" cx="45%" cy="35%" r="70%">
        <stop offset="0" stop-color="#27344a"/>
        <stop offset="0.55" stop-color="#101827"/>
        <stop offset="1" stop-color="#060b13"/>
      </radialGradient>
    </defs>
    <rect x="64" y="64" width="${width - 128}" height="${height - 128}" rx="42" fill="none" stroke="#c99c35" stroke-width="18"/>
    <rect x="120" y="120" width="${width - 240}" height="${height - 240}" rx="36" fill="none" stroke="#f4ead4" stroke-opacity="0.22" stroke-width="4"/>

    <g filter="url(#shadow)">
      ${text({ x: 1800, y: 345, value: 'A.M.I.N.A. inside SAM', size: 178, weight: 900, fill: '#f2d36f' })}
      ${text({ x: 1800, y: 470, value: 'The trust-layer engine inside governed acceleration', size: 64, weight: 650, fill: '#fff7e8', style: 'font-style: italic;' })}
    </g>

    <g filter="url(#shadow)">
      ${labelBox({ x: 1380, y: 710, w: 840, h: 150, title: 'SIGNALS', subtitle: 'source to signal' })}
      ${labelBox({ x: 2420, y: 1690, w: 830, h: 150, title: 'ALIGNMENT', subtitle: 'authority named' })}
      ${labelBox({ x: 350, y: 1690, w: 830, h: 150, title: 'MOMENTUM', subtitle: 'learning loop' })}
    </g>

    <g filter="url(#shadow)">
      ${aminaCell({ x: 390, y: 2440, letter: 'A', title: 'ALIGN', subtitle: 'bound the work' })}
      ${aminaCell({ x: 820, y: 2440, letter: 'M', title: 'MAP', subtitle: 'name authority', fill: '#dff3ee' })}
      ${aminaCell({ x: 1235, y: 2390, letter: 'I', title: 'INSTRUMENT', subtitle: 'attach receipt', titleSize: 40 })}
      ${aminaCell({ x: 1940, y: 2440, letter: 'N', title: 'NEGOTIATE', subtitle: 'set the gate', fill: '#dff3ee', titleSize: 44 })}
      ${aminaCell({ x: 2830, y: 2440, letter: 'A', title: 'AUDIT', subtitle: 'feed learning' })}
    </g>

    <g filter="url(#shadow)">
      ${receiptCard({ x: 310, y: 3850, title: 'ASK', subtitle: 'What did the human want?' })}
      ${receiptCard({ x: 1470, y: 3850, title: 'ACT', subtitle: 'What did the agent do?' })}
      ${receiptCard({ x: 2630, y: 3850, title: 'ATTEST', subtitle: 'What can be verified?' })}
    </g>

    <g filter="url(#shadow)">
      <path d="${chamferedPath({ x: 270, y: 4185, w: 3060, h: 220, cut: 46 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="9" opacity="0.92"/>
      <path d="${chamferedPath({ x: 300, y: 4215, w: 3000, h: 160, cut: 34 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.28" stroke-width="4"/>
      ${text({ x: 1800, y: 4274, value: 'A.M.I.N.A. turns SAM into a governed operating loop.', size: 62, weight: 900, fill: '#fff7e8' })}
      ${text({ x: 1800, y: 4356, value: 'Ask clearly. Act within authority. Attest with receipts a human can review.', size: 46, weight: 760, fill: '#f2d36f' })}
    </g>
  </svg>`;
}

async function ensureBase() {
  if (placeholder) {
    return sharp({
      create: {
        width,
        height,
        channels: 4,
        background: '#0b1424',
      },
    })
      .png()
      .toBuffer();
  }

  try {
    await fs.access(basePath);
  } catch {
    throw new Error(`Missing textless base image: ${basePath}\nCreate or copy the selected base to this path, or run with --placeholder to test label placement.`);
  }

  return sharp(basePath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();
}

await fs.mkdir(path.dirname(outPath), { recursive: true });
const base = await ensureBase();

await sharp(base)
  .composite([{ input: Buffer.from(overlaySvg()), top: 0, left: 0 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outPath);

console.log(outPath);
