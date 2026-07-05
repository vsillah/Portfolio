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
const defaultBase = path.join(root, 'source-assets/illustration-bases/figure-ii-1-authority-ladder-base.png');
const outDir = path.join(root, 'manuscript/visuals/rendered/publication-plates');
const defaultOut = path.join(outDir, 'figure-ii-1-authority-ladder-publication-plate.png');

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
}

const basePath = path.resolve(argValue('--base') ?? defaultBase);
const outPath = path.resolve(argValue('--out') ?? defaultOut);
const placeholder = process.argv.includes('--placeholder');

const width = 3000;
const height = 4700;

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

function chamferedPath({ x, y, w, h, cut = 34 }) {
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

function plaque({ x, y, w, h, title, subtitle, titleSize = 52, subtitleSize = 30, tone = 'darkPlaque' }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 34 })}" fill="url(#${tone})" stroke="#c99c35" stroke-width="7" opacity="0.9"/>
    <path d="${chamferedPath({ x: x + 16, y: y + 16, w: w - 32, h: h - 32, cut: 24 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.30" stroke-width="3"/>
    ${text({ x: x + w / 2, y: y + h * 0.45, value: title, size: titleSize, weight: 900, fill: '#fff7e8' })}
    ${text({ x: x + w / 2, y: y + h * 0.73, value: subtitle, size: subtitleSize, weight: 720, fill: '#f2d36f' })}
  `;
}

function gate({ x, y, w, h, label, tone = 'darkPlaque' }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 28 })}" fill="url(#${tone})" stroke="#c99c35" stroke-width="6" opacity="0.9"/>
    <path d="${chamferedPath({ x: x + 14, y: y + 14, w: w - 28, h: h - 28, cut: 20 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.28" stroke-width="3"/>
    ${text({ x: x + w / 2, y: y + h * 0.58, value: label, size: 34, weight: 850, fill: '#fff7e8' })}
  `;
}

function titlePlate() {
  const x = 420;
  const y = 86;
  const w = 2160;
  const h = 195;

  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 56 })}" fill="url(#titlePlaque)" stroke="#c99c35" stroke-width="9" opacity="0.86"/>
    <path d="${chamferedPath({ x: x + 22, y: y + 22, w: w - 44, h: h - 44, cut: 42 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.32" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + 82, value: 'Authority ladder', size: 88, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + w / 2, y: y + 143, value: 'Authority climbs only when evidence climbs with it', size: 38, weight: 650, fill: '#fff7e8' })}
  `;
}

function overlaySvg() {
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.38"/>
      </filter>
      <linearGradient id="darkPlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#182338"/>
        <stop offset="0.48" stop-color="#0c1628"/>
        <stop offset="1" stop-color="#253143"/>
      </linearGradient>
      <linearGradient id="redPlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3b1616"/>
        <stop offset="0.56" stop-color="#1b1016"/>
        <stop offset="1" stop-color="#4a211f"/>
      </linearGradient>
      <linearGradient id="titlePlaque" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1d2a3f"/>
        <stop offset="0.48" stop-color="#0c1628"/>
        <stop offset="1" stop-color="#2c3547"/>
      </linearGradient>
    </defs>

    <rect x="48" y="48" width="${width - 96}" height="${height - 96}" rx="32" fill="none" stroke="#c99c35" stroke-width="14"/>
    <rect x="96" y="96" width="${width - 192}" height="${height - 192}" rx="26" fill="none" stroke="#f4ead4" stroke-opacity="0.18" stroke-width="4"/>

    <g filter="url(#shadow)">
      ${titlePlate()}
    </g>

    <g filter="url(#shadow)">
      ${plaque({
        x: 1060,
        y: 910,
        w: 1060,
        h: 212,
        title: 'Execute',
        subtitle: 'only after explicit authority',
        titleSize: 58,
        subtitleSize: 31,
        tone: 'redPlaque',
      })}
      ${plaque({
        x: 1060,
        y: 1756,
        w: 1060,
        h: 212,
        title: 'Stage',
        subtitle: 'prepare external action for review',
        titleSize: 58,
        subtitleSize: 29,
        tone: 'redPlaque',
      })}
      ${plaque({
        x: 1060,
        y: 2614,
        w: 1060,
        h: 212,
        title: 'Route',
        subtitle: 'move work to the right human lane',
        titleSize: 58,
        subtitleSize: 29,
      })}
      ${plaque({
        x: 1060,
        y: 3460,
        w: 1060,
        h: 212,
        title: 'Recommend',
        subtitle: 'suggest next action with evidence',
        titleSize: 54,
        subtitleSize: 29,
      })}
      ${plaque({
        x: 1060,
        y: 4308,
        w: 1060,
        h: 212,
        title: 'Prepare',
        subtitle: 'draft, summarize, classify',
        titleSize: 58,
        subtitleSize: 31,
      })}
    </g>

    <g filter="url(#shadow)">
      ${gate({ x: 110, y: 1008, w: 620, h: 130, label: 'Receipt required' })}
      ${gate({ x: 110, y: 1900, w: 620, h: 130, label: 'Source check required' })}
      ${gate({ x: 110, y: 2768, w: 620, h: 130, label: 'Human gate required', tone: 'redPlaque' })}
      ${gate({ x: 110, y: 3632, w: 620, h: 130, label: 'Rollback path required', tone: 'redPlaque' })}
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
