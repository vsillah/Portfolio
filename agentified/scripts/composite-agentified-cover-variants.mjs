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
const width = 1800;
const height = 2700;
const coverBaseDir = path.join(root, 'source-assets/cover-bases');
const outDir = path.join(root, 'manuscript/visuals/rendered/cover-comps');

const variants = [
  {
    key: 'a-sam-trust-engine',
    base: 'agentified-cover-a-sam-trust-engine-base.png',
    out: 'agentified-cover-a-sam-trust-engine.png',
    titleY: 402,
    subtitleY: 560,
    process: true,
  },
  {
    key: 'b-receipt-gate',
    base: 'agentified-cover-b-receipt-gate-base.png',
    out: 'agentified-cover-b-receipt-gate.png',
    titleY: 402,
    subtitleY: 560,
  },
  {
    key: 'c-portfolio-os',
    base: 'agentified-cover-c-portfolio-os-base.png',
    out: 'agentified-cover-c-portfolio-os.png',
    titleY: 402,
    subtitleY: 560,
  },
];

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function text({ x, y, value, size, weight = 700, fill = '#f2d36f', anchor = 'middle', family = 'Georgia, Times New Roman, serif', style = '' }) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" style="${style}">${escapeXml(value)}</text>`;
}

function line({ x1, y1, x2, y2, stroke = '#c99c35', width: strokeWidth = 3, opacity = 0.75 }) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${opacity}"/>`;
}

function chamferedPath({ x, y, w, h, cut = 42 }) {
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

function plate({ x, y, w, h, cut = 42, opacity = 0.92 }) {
  return `
    <path d="${chamferedPath({ x, y, w, h, cut })}" fill="url(#enamel)" stroke="url(#goldStroke)" stroke-width="6" stroke-opacity="0.84" opacity="${opacity}"/>
    <path d="${chamferedPath({ x: x + 24, y: y + 22, w: w - 48, h: h - 44, cut: Math.max(20, cut - 14) })}" fill="none" stroke="#f5e4ae" stroke-width="2" stroke-opacity="0.18"/>
  `;
}

function stepBadge({ x, y, w, h, label, detail, align = 'middle' }) {
  const textX = align === 'start' ? x + 36 : align === 'end' ? x + w - 36 : x + w / 2;

  return `
    <g filter="url(#badgeShadow)">
      <path d="${chamferedPath({ x, y, w, h, cut: 24 })}" fill="url(#smallEnamel)" stroke="url(#goldStroke)" stroke-width="4" stroke-opacity="0.82" opacity="0.90"/>
      <path d="${chamferedPath({ x: x + 14, y: y + 12, w: w - 28, h: h - 24, cut: 16 })}" fill="none" stroke="#f5e4ae" stroke-width="1.5" stroke-opacity="0.18"/>
      ${text({
        x: textX,
        y: y + 42,
        value: label,
        size: 30,
        weight: 760,
        fill: '#f4d978',
        anchor: align,
        family: 'Avenir Next, Inter, Arial, sans-serif',
        style: 'letter-spacing: 2px;',
      })}
      ${text({
        x: textX,
        y: y + 76,
        value: detail,
        size: 21,
        weight: 650,
        fill: '#fff7e8',
        anchor: align,
        family: 'Avenir Next, Inter, Arial, sans-serif',
      })}
    </g>
  `;
}

function processCallouts(variant) {
  if (!variant.process) return '';

  return `
    <g>
      ${stepBadge({ x: 674, y: 982, w: 452, h: 96, label: 'ALIGN', detail: 'Work to intent' })}
      ${stepBadge({ x: 292, y: 1358, w: 362, h: 96, label: 'MAP', detail: 'Authority and roles' })}
      ${stepBadge({ x: 90, y: 1698, w: 396, h: 96, label: 'INSTRUMENT', detail: 'Receipts and signals', align: 'start' })}
      ${stepBadge({ x: 1314, y: 1698, w: 396, h: 96, label: 'NEGOTIATE', detail: 'Gates and approvals', align: 'end' })}
      ${stepBadge({ x: 692, y: 2148, w: 416, h: 96, label: 'AUDIT', detail: 'Outcomes and drift' })}
    </g>
  `;
}

function overlaySvg(variant) {
  return `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="titleShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.72"/>
      </filter>
      <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.58"/>
      </filter>
      <linearGradient id="topFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#06101c" stop-opacity="0.88"/>
        <stop offset="0.58" stop-color="#06101c" stop-opacity="0.58"/>
        <stop offset="1" stop-color="#06101c" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="bottomFade" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#06101c" stop-opacity="0.88"/>
        <stop offset="0.60" stop-color="#06101c" stop-opacity="0.44"/>
        <stop offset="1" stop-color="#06101c" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="goldStroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a56f24"/>
        <stop offset="0.5" stop-color="#f4d77b"/>
        <stop offset="1" stop-color="#a56f24"/>
      </linearGradient>
      <linearGradient id="enamel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101d2f" stop-opacity="0.92"/>
        <stop offset="0.52" stop-color="#07111f" stop-opacity="0.90"/>
        <stop offset="1" stop-color="#1b2431" stop-opacity="0.92"/>
      </linearGradient>
      <linearGradient id="smallEnamel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#162337" stop-opacity="0.88"/>
        <stop offset="0.46" stop-color="#07111f" stop-opacity="0.82"/>
        <stop offset="1" stop-color="#1d2836" stop-opacity="0.88"/>
      </linearGradient>
    </defs>

    <rect x="0" y="0" width="${width}" height="720" fill="url(#topFade)"/>
    <rect x="0" y="2070" width="${width}" height="630" fill="url(#bottomFade)"/>
    <rect x="68" y="68" width="${width - 136}" height="${height - 136}" rx="18" fill="none" stroke="url(#goldStroke)" stroke-width="8" stroke-opacity="0.88"/>
    <rect x="98" y="98" width="${width - 196}" height="${height - 196}" rx="14" fill="none" stroke="#f5e4ae" stroke-width="2" stroke-opacity="0.20"/>

    <g filter="url(#titleShadow)">
      ${plate({ x: 420, y: 304, w: 960, h: 164, cut: 38, opacity: 0.93 })}
      ${text({ x: width / 2, y: variant.titleY, value: 'Agentified', size: 92, weight: 700, fill: '#f4d978' })}
    </g>

    <g filter="url(#titleShadow)">
      ${plate({ x: 470, y: 508, w: 860, h: 172, cut: 34, opacity: 0.91 })}
      ${text({ x: width / 2, y: variant.subtitleY, value: "The Product Leader's Guide to", size: 26, weight: 700, fill: '#fff7e8' })}
      ${text({ x: width / 2, y: variant.subtitleY + 40, value: 'Superhuman Acceleration', size: 26, weight: 700, fill: '#fff7e8' })}
      ${text({ x: width / 2, y: variant.subtitleY + 80, value: 'Built on Trust', size: 26, weight: 700, fill: '#fff7e8' })}
    </g>

    ${processCallouts(variant)}

    <g filter="url(#titleShadow)">
      <path d="${chamferedPath({ x: 438, y: 2348, w: 924, h: 142, cut: 34 })}" fill="url(#enamel)" stroke="url(#goldStroke)" stroke-width="5" stroke-opacity="0.76"/>
      ${text({ x: width / 2, y: 2438, value: 'VAMBAH SILLAH', size: 42, weight: 700, fill: '#fff7e8', style: 'letter-spacing: 7px;' })}
    </g>
  </svg>`;
}

await fs.mkdir(outDir, { recursive: true });

for (const variant of variants) {
  const basePath = path.join(coverBaseDir, variant.base);
  const outPath = path.join(outDir, variant.out);
  await fs.access(basePath);
  const base = await sharp(basePath)
    .resize(width, height, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  await sharp(base)
    .composite([{ input: Buffer.from(overlaySvg(variant)), top: 0, left: 0 }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outPath);

  console.log(outPath);
}
