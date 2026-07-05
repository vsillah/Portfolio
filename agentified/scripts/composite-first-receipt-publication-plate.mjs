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
const defaultBase = path.join(root, 'source-assets/illustration-bases/figure-1-1-first-receipt-base.png');
const outDir = path.join(root, 'manuscript/visuals/rendered/publication-plates');
const defaultOut = path.join(outDir, 'figure-1-1-first-receipt-publication-plate.png');

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const basePath = path.resolve(argValue('--base') ?? defaultBase);
const outPath = path.resolve(argValue('--out') ?? defaultOut);
const placeholder = process.argv.includes('--placeholder');

const width = 4000;
const height = 2500;

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

function plaque({ x, y, w, h, title, subtitle, titleSize = 58, subtitleSize = 28 }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 42 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="8" opacity="0.91"/>
    <path d="${chamferedPath({ x: x + 18, y: y + 18, w: w - 36, h: h - 36, cut: 28 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.34" stroke-width="3"/>
    ${text({ x: x + w / 2, y: y + h * 0.48, value: title, size: titleSize, weight: 900, fill: '#fff7e8' })}
    ${text({ x: x + w / 2, y: y + h * 0.75, value: subtitle, size: subtitleSize, weight: 700, fill: '#f2d36f' })}
  `;
}

function fieldChip({ x, y, label }) {
  return `
    <path d="${chamferedPath({ x, y, w: 330, h: 82, cut: 22 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="5" opacity="0.9"/>
    ${text({ x: x + 165, y: y + 54, value: label, size: 34, weight: 850, fill: '#fff7e8' })}
  `;
}

function titlePlate() {
  const x = 455;
  const y = 130;
  const w = 3090;
  const h = 260;

  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 70 })}" fill="url(#titlePlaque)" stroke="#c99c35" stroke-width="10" opacity="0.91"/>
    <path d="${chamferedPath({ x: x + 26, y: y + 26, w: w - 52, h: h - 52, cut: 52 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.36" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + 112, value: 'The first receipt', size: 132, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + w / 2, y: y + 188, value: 'An agent action becomes trustworthy when evidence travels with it', size: 48, weight: 650, fill: '#fff7e8', style: 'font-style: italic;' })}
  `;
}

function overlaySvg() {
  const fields = [
    ['INTENT', 1455, 830],
    ['AGENT', 1840, 830],
    ['SOURCE', 2225, 830],
    ['ACTION', 1455, 1035],
    ['ARTIFACT', 1840, 1035],
    ['APPROVAL', 2225, 1035],
    ['COST', 1455, 1240],
    ['OUTCOME', 1840, 1240],
    ['ROLLBACK', 2225, 1240],
  ];

  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="11" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
      <linearGradient id="darkPlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#182338"/>
        <stop offset="0.48" stop-color="#0c1628"/>
        <stop offset="1" stop-color="#253143"/>
      </linearGradient>
      <linearGradient id="titlePlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1d2a3f"/>
        <stop offset="0.48" stop-color="#0c1628"/>
        <stop offset="1" stop-color="#2c3547"/>
      </linearGradient>
    </defs>

    <rect x="54" y="54" width="${width - 108}" height="${height - 108}" rx="36" fill="none" stroke="#c99c35" stroke-width="16"/>
    <rect x="104" y="104" width="${width - 208}" height="${height - 208}" rx="28" fill="none" stroke="#f4ead4" stroke-opacity="0.20" stroke-width="4"/>

    <g filter="url(#shadow)">
      ${titlePlate()}
    </g>

    <g filter="url(#shadow)">
      ${plaque({ x: 215, y: 1715, w: 760, h: 160, title: 'AGENT RUN', subtitle: 'drafts or recommends work', titleSize: 54, subtitleSize: 26 })}
      ${plaque({ x: 1520, y: 1510, w: 960, h: 170, title: 'RECEIPT ENVELOPE', subtitle: 'evidence around the action', titleSize: 54, subtitleSize: 28 })}
      ${plaque({ x: 2865, y: 840, w: 780, h: 160, title: 'HUMAN GATE', subtitle: 'approve, hold, or reject', titleSize: 54, subtitleSize: 26 })}
      ${plaque({ x: 2920, y: 1715, w: 760, h: 160, title: 'OUTCOME', subtitle: 'ship, revise, or rollback', titleSize: 56, subtitleSize: 26 })}
    </g>

    <g filter="url(#shadow)">
      ${fields.map(([label, x, y]) => fieldChip({ x, y, label })).join('\n')}
    </g>

    <g filter="url(#shadow)">
      <path d="${chamferedPath({ x: 340, y: 2140, w: 3320, h: 210, cut: 48 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="9" opacity="0.92"/>
      <path d="${chamferedPath({ x: 370, y: 2170, w: 3260, h: 150, cut: 34 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.28" stroke-width="4"/>
      ${text({ x: 2000, y: 2228, value: 'The output is what the reader sees. The receipt is what the organization needs.', size: 52, weight: 900, fill: '#fff7e8' })}
      ${text({ x: 2000, y: 2302, value: 'Intent, source, approval, cost, outcome, and rollback make the work inspectable.', size: 40, weight: 760, fill: '#f2d36f' })}
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
