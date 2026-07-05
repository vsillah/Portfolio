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
const defaultBase = path.join(root, 'source-assets/illustration-bases/figure-8-1-portfolio-first-stack-base.png');
const outDir = path.join(root, 'manuscript/visuals/rendered/publication-plates');
const defaultOut = path.join(outDir, 'figure-8-1-portfolio-first-stack-publication-plate.png');

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

function plaque({ x, y, w, h, title, subtitle, titleSize = 46, subtitleSize = 27, tone = 'darkPlaque' }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 36 })}" fill="url(#${tone})" stroke="#c99c35" stroke-width="7" opacity="0.9"/>
    <path d="${chamferedPath({ x: x + 16, y: y + 16, w: w - 32, h: h - 32, cut: 24 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.30" stroke-width="3"/>
    ${text({ x: x + w / 2, y: y + h * 0.46, value: title, size: titleSize, weight: 900, fill: '#fff7e8' })}
    ${text({ x: x + w / 2, y: y + h * 0.73, value: subtitle, size: subtitleSize, weight: 720, fill: '#f2d36f' })}
  `;
}

function titlePlate() {
  const x = 560;
  const y = 86;
  const w = 2880;
  const h = 210;

  return `
    <path d="${chamferedPath({ x, y, w, h, cut: 64 })}" fill="url(#titlePlaque)" stroke="#c99c35" stroke-width="9" opacity="0.88"/>
    <path d="${chamferedPath({ x: x + 24, y: y + 24, w: w - 48, h: h - 48, cut: 46 })}" fill="none" stroke="#f3d77e" stroke-opacity="0.32" stroke-width="4"/>
    ${text({ x: x + w / 2, y: y + 88, value: 'Portfolio-first operating stack', size: 92, weight: 900, fill: '#f2d36f' })}
    ${text({ x: x + w / 2, y: y + 152, value: 'The owned corpus becomes memory, roles, controls, cockpit, and public-safe proof', size: 37, weight: 650, fill: '#fff7e8' })}
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

    <rect x="52" y="52" width="${width - 104}" height="${height - 104}" rx="34" fill="none" stroke="#c99c35" stroke-width="14"/>
    <rect x="104" y="104" width="${width - 208}" height="${height - 208}" rx="28" fill="none" stroke="#f4ead4" stroke-opacity="0.18" stroke-width="4"/>

    <g filter="url(#shadow)">
      ${titlePlate()}
    </g>

    <g filter="url(#shadow)">
      ${plaque({
        x: 330,
        y: 2026,
        w: 1258,
        h: 205,
        title: 'Owned portfolio and corpus',
        subtitle: 'public, client-safe, internal, private',
        titleSize: 50,
        subtitleSize: 29,
      })}
      ${plaque({
        x: 250,
        y: 824,
        w: 760,
        h: 156,
        title: 'Open Brain',
        subtitle: 'sources, events, proposals, memories',
        titleSize: 48,
        subtitleSize: 25,
      })}
      ${plaque({
        x: 1190,
        y: 858,
        w: 780,
        h: 150,
        title: 'Harness',
        subtitle: 'Codex, tools, browser, apps, worktrees',
        titleSize: 48,
        subtitleSize: 24,
      })}
      ${plaque({
        x: 2052,
        y: 846,
        w: 820,
        h: 160,
        title: 'Agent roles',
        subtitle: 'Shaka, Amina, specialist lanes',
        titleSize: 48,
        subtitleSize: 25,
      })}
      ${plaque({
        x: 1682,
        y: 1762,
        w: 1470,
        h: 205,
        title: 'Controls',
        subtitle: 'receipts, approvals, evals, drift checks',
        titleSize: 54,
        subtitleSize: 31,
      })}
      ${plaque({
        x: 2846,
        y: 860,
        w: 690,
        h: 154,
        title: 'Mission Control',
        subtitle: 'inspect, route, approve, recover',
        titleSize: 43,
        subtitleSize: 24,
      })}
      ${plaque({
        x: 3370,
        y: 1452,
        w: 510,
        h: 164,
        title: 'Public-safe proof',
        subtitle: 'export without raw logs',
        titleSize: 36,
        subtitleSize: 22,
      })}
      ${plaque({
        x: 3304,
        y: 2030,
        w: 568,
        h: 188,
        title: 'Raw private logs stay inside',
        subtitle: 'contain, redact, exclude',
        titleSize: 34,
        subtitleSize: 23,
        tone: 'redPlaque',
      })}
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
