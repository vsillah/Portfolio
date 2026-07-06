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
const defaultBase = path.join(root, 'source-assets/illustration-bases/figure-0-1-sam-trust-layer-base.png');
const outDir = path.join(root, 'manuscript/visuals/rendered/publication-plates');
const defaultOut = path.join(outDir, 'figure-0-1-sam-trust-layer-publication-plate.png');

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

function plaque({ x, y, w, h, title, subtitle, titleSize = 68, subtitleSize = 32 }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 46 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="8" opacity="0.91"/>
    <path d="${chamferedPath({ x: x + 18, y: y + 18, w: w - 36, h: h - 36, cut: 30 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.34" stroke-width="3"/>
    <path d="M ${x + 92} ${y + h - 34} C ${x + w * 0.36} ${y + h - 14}, ${x + w * 0.64} ${y + h - 14}, ${x + w - 92} ${y + h - 34}" fill="none" stroke="#f3d77e" stroke-opacity="0.22" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + h * 0.48, value: title, size: titleSize, weight: 900, fill: '#fff7e8' })}
    ${text({ x: x + w / 2, y: y + h * 0.76, value: subtitle, size: subtitleSize, weight: 700, fill: '#f2d36f' })}
  `;
}

function trustMedallion({ x, y, title, subtitle }) {
  return `
    <circle cx="${x}" cy="${y}" r="118" fill="url(#navyMedallion)" stroke="#c99c35" stroke-width="9" opacity="0.93"/>
    <circle cx="${x}" cy="${y}" r="96" fill="none" stroke="#f3d77e" stroke-opacity="0.32" stroke-width="4"/>
    ${text({ x, y: y - 8, value: title, size: 46, weight: 900, fill: '#f2d36f' })}
    ${text({ x, y: y + 46, value: subtitle, size: 22, weight: 700, fill: '#fff7e8' })}
  `;
}

function titlePlate() {
  const x = 415;
  const y = 130;
  const w = 3170;
  const h = 260;

  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 70 })}" fill="url(#titlePlaque)" stroke="#c99c35" stroke-width="10" opacity="0.91"/>
    <path d="${chamferedPath({ x: x + 26, y: y + 26, w: w - 52, h: h - 52, cut: 52 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.36" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + 112, value: 'SAM with the trust layer', size: 128, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + w / 2, y: y + 188, value: 'Acceleration becomes governable when the evidence moves with the work', size: 48, weight: 650, fill: '#fff7e8', style: 'font-style: italic;' })}
  `;
}

function overlaySvg() {
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
      <radialGradient id="navyMedallion" cx="45%" cy="35%" r="70%">
        <stop offset="0" stop-color="#27344a"/>
        <stop offset="0.55" stop-color="#101827"/>
        <stop offset="1" stop-color="#060b13"/>
      </radialGradient>
    </defs>

    <rect x="54" y="54" width="${width - 108}" height="${height - 108}" rx="36" fill="none" stroke="#c99c35" stroke-width="16"/>
    <rect x="104" y="104" width="${width - 208}" height="${height - 208}" rx="28" fill="none" stroke="#f4ead4" stroke-opacity="0.20" stroke-width="4"/>

    <g filter="url(#shadow)">
      ${titlePlate()}
    </g>

    <g filter="url(#shadow)">
      ${plaque({ x: 235, y: 1795, w: 880, h: 170, title: 'SIGNALS', subtitle: 'raw noise to clear signal', titleSize: 66, subtitleSize: 30 })}
      ${plaque({ x: 1560, y: 1795, w: 880, h: 170, title: 'ALIGNMENT', subtitle: 'insight to shared direction', titleSize: 60, subtitleSize: 30 })}
      ${plaque({ x: 2885, y: 1795, w: 880, h: 170, title: 'MOMENTUM', subtitle: 'systems that compound', titleSize: 60, subtitleSize: 30 })}
    </g>

    <g filter="url(#shadow)">
      <path d="M 650 730 C 1120 570, 1490 570, 1960 730 S 2800 890, 3350 730" fill="none" stroke="#c99c35" stroke-opacity="0.72" stroke-width="12" stroke-linecap="round"/>
      ${trustMedallion({ x: 720, y: 720, title: 'SOURCE', subtitle: 'what did it read?' })}
      ${trustMedallion({ x: 1360, y: 635, title: 'RECEIPT', subtitle: 'what happened?' })}
      ${trustMedallion({ x: 2000, y: 720, title: 'GATE', subtitle: 'who approves?' })}
      ${trustMedallion({ x: 2640, y: 805, title: 'EVAL', subtitle: 'did it work?' })}
      ${trustMedallion({ x: 3280, y: 720, title: 'PROOF', subtitle: 'show it safely' })}
    </g>

    <g filter="url(#shadow)">
      <path d="${chamferedPath({ x: 340, y: 2140, w: 3320, h: 210, cut: 48 })}" fill="url(#darkPlaque)" stroke="#c99c35" stroke-width="9" opacity="0.92"/>
      <path d="${chamferedPath({ x: 370, y: 2170, w: 3260, h: 150, cut: 34 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.28" stroke-width="4"/>
      ${text({ x: 2000, y: 2228, value: 'SAM creates acceleration. The trust layer makes acceleration governable.', size: 58, weight: 900, fill: '#fff7e8' })}
      ${text({ x: 2000, y: 2302, value: 'Source, receipt, gate, evaluation, and proof travel with the work.', size: 42, weight: 760, fill: '#f2d36f' })}
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
