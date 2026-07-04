#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { chromium } from "playwright";

const root = "/Users/vambahsillah/Projects/Portfolio/agentified";
const monoRoot = join(root, "manuscript/visuals/rendered/print/monochrome");
const svgDir = join(monoRoot, "svg");
const pngDir = join(monoRoot, "png-600dpi");
const tiffDir = join(monoRoot, "tiff-600dpi");
const reviewDir = join(monoRoot, "review-png");
const proofDir = join(monoRoot, "proofs");

for (const dir of [svgDir, pngDir, tiffDir, reviewDir, proofDir]) {
  mkdirSync(dir, { recursive: true });
}

const ink = {
  black: "#111111",
  dark: "#2A2A2A",
  mid: "#555555",
  light: "#D4D4D4",
  pale: "#F4F4F4",
  paper: "#FFFFFF",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function svgWrap({ title, subtitle, width = 1600, height = 1000, body }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${esc(title)}</title>
  <desc id="desc">${esc(subtitle)}</desc>
  <defs>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="14" stroke="${ink.mid}" stroke-width="3"/>
    </pattern>
    <pattern id="dots" patternUnits="userSpaceOnUse" width="16" height="16">
      <circle cx="4" cy="4" r="2.2" fill="${ink.mid}"/>
      <circle cx="12" cy="12" r="2.2" fill="${ink.mid}"/>
    </pattern>
    <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="16" height="16">
      <path d="M0 0L16 16M16 0L0 16" stroke="${ink.mid}" stroke-width="2"/>
    </pattern>
    <marker id="arrow" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L12,7 L2,12 Z" fill="${ink.black}"/>
    </marker>
    <marker id="arrowLight" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L12,7 L2,12 Z" fill="${ink.mid}"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="${ink.paper}"/>
  <rect x="32" y="32" width="${width - 64}" height="${height - 64}" fill="${ink.paper}" stroke="${ink.black}" stroke-width="5"/>
  <text x="${width / 2}" y="88" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="42" font-weight="800" fill="${ink.black}">${esc(title)}</text>
  <text x="${width / 2}" y="128" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="22" fill="${ink.dark}">${esc(subtitle)}</text>
  ${body}
</svg>
`;
}

function text(
  x,
  y,
  value,
  { size = 24, weight = 600, fill = ink.black, anchor = "middle" } = {},
) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`;
}

function multiline(x, y, lines, opts = {}) {
  const size = opts.size ?? 22;
  const gap = opts.gap ?? Math.round(size * 1.28);
  return lines.map((line, idx) => text(x, y + idx * gap, line, opts)).join("\n");
}

function card(x, y, w, h, title, lines, { tone = "plain", titleSize = 25 } = {}) {
  const fills = {
    plain: ink.paper,
    light: ink.pale,
    hatch: "url(#hatch)",
    dots: "url(#dots)",
    cross: "url(#crosshatch)",
  };
  const topFill = tone === "plain" || tone === "light" ? ink.dark : ink.paper;
  const topStroke = tone === "plain" || tone === "light" ? ink.dark : ink.black;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fills[tone]}" stroke="${ink.black}" stroke-width="4"/>
    <rect x="${x}" y="${y}" width="${w}" height="16" fill="${topFill}" stroke="${topStroke}" stroke-width="0"/>
    ${text(x + w / 2, y + 54, title, { size: titleSize, weight: 850 })}
    ${multiline(x + w / 2, y + 90, lines, { size: 19, weight: 500, fill: ink.dark })}
  </g>`;
}

function arrow(x1, y1, x2, y2, { width = 5, dash = "", marker = "arrow" } = {}) {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink.black}" stroke-width="${width}" stroke-linecap="round"${dashAttr} marker-end="url(#${marker})"/>`;
}

function pill(x, y, w, h, label, { fill = ink.paper, pattern = "", stroke = ink.black, border = 3, size = 19 } = {}) {
  const fillValue = pattern || fill;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fillValue}" stroke="${stroke}" stroke-width="${border}"/>
  ${text(x + w / 2, y + h / 2 + 7, label, { size, weight: 800 })}`;
}

function stackRow(x, y, w, h, title, subtitle, tone = "plain") {
  const fill = tone === "hatch" ? "url(#hatch)" : tone === "dots" ? "url(#dots)" : tone === "light" ? ink.pale : ink.paper;
  const borderWidth = tone === "hatch" || tone === "dots" ? 5 : 4;
  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${ink.black}" stroke-width="${borderWidth}"/>
    <rect x="${x}" y="${y}" width="${w}" height="14" fill="${tone === "plain" ? ink.dark : ink.paper}" stroke="${ink.black}" stroke-width="0"/>
    ${text(x + w / 2, y + 42, title, { size: 24, weight: 850 })}
    ${text(x + w / 2, y + 72, subtitle, { size: 18, weight: 500, fill: ink.dark })}
  </g>`;
}

const figures = [
  {
    file: "figure-0-1-sam-trust-layer-monochrome",
    title: "Figure 0.1. SAM with the trust layer",
    svg: svgWrap({
      title: "SAM with the Trust Layer",
      subtitle: "Acceleration becomes capacity when the evidence moves with the work.",
      body: `
  <g>
    ${card(90, 210, 430, 280, "Signals", ["Raw noise", "to clear signal"], { tone: "plain" })}
    ${card(585, 210, 430, 280, "Alignment", ["Insight", "to shared direction"], { tone: "light" })}
    ${card(1080, 210, 430, 280, "Momentum", ["Systems", "that compound"], { tone: "plain" })}
    ${arrow(520, 350, 585, 350)}
    ${arrow(1015, 350, 1080, 350)}
    ${text(800, 545, "Agentified adds the trust layer", { size: 28, weight: 850 })}
    ${pill(135, 620, 210, 72, "Source")}
    ${pill(390, 620, 210, 72, "Receipt", { pattern: "url(#dots)" })}
    ${pill(645, 620, 210, 72, "Gate", { pattern: "url(#hatch)", border: 5 })}
    ${pill(900, 620, 210, 72, "Eval")}
    ${pill(1155, 620, 210, 72, "Proof", { pattern: "url(#dots)" })}
    ${arrow(345, 656, 390, 656, { width: 4 })}
    ${arrow(600, 656, 645, 656, { width: 4 })}
    ${arrow(855, 656, 900, 656, { width: 4 })}
    ${arrow(1110, 656, 1155, 656, { width: 4 })}
    ${arrow(305, 500, 235, 610, { dash: "10 10", width: 4, marker: "arrowLight" })}
    ${arrow(800, 500, 750, 610, { dash: "10 10", width: 4, marker: "arrowLight" })}
    ${arrow(1295, 500, 1005, 610, { dash: "10 10", width: 4, marker: "arrowLight" })}
    ${text(235, 740, "What did it read?", { size: 18, fill: ink.dark })}
    ${text(750, 740, "Who approves?", { size: 18, fill: ink.dark })}
    ${text(1005, 740, "Did it work?", { size: 18, fill: ink.dark })}
    <rect x="176" y="805" width="1248" height="78" fill="${ink.black}"/>
    ${text(800, 855, "SAM creates acceleration. The trust layer makes acceleration governable.", { size: 30, weight: 850, fill: ink.paper })}
  </g>`,
    }),
  },
  {
    file: "figure-1-1-first-receipt-monochrome",
    title: "Figure 1.1. The first receipt",
    svg: svgWrap({
      title: "The First Receipt",
      subtitle: "A visible envelope around an agent action, before authority expands.",
      body: `
  <g>
    ${card(90, 230, 300, 170, "Agent run", ["Drafts or", "recommends work"], { tone: "plain" })}
    ${card(470, 230, 300, 170, "Receipt", ["Evidence travels", "with the output"], { tone: "dots" })}
    ${card(850, 230, 300, 170, "Human gate", ["Approve, hold,", "or reject"], { tone: "hatch" })}
    ${card(1230, 230, 300, 170, "Outcome", ["Ship, revise,", "or rollback"], { tone: "plain" })}
    ${arrow(390, 315, 470, 315)}
    ${arrow(770, 315, 850, 315)}
    ${arrow(1150, 315, 1230, 315)}
    <rect x="192" y="520" width="1216" height="300" fill="${ink.pale}" stroke="${ink.black}" stroke-width="4"/>
    ${text(800, 570, "Inside the receipt", { size: 30, weight: 850 })}
    ${pill(245, 620, 185, 58, "Intent")}
    ${pill(465, 620, 185, 58, "Agent")}
    ${pill(685, 620, 185, 58, "Source")}
    ${pill(905, 620, 185, 58, "Action")}
    ${pill(1125, 620, 185, 58, "Artifact")}
    ${pill(245, 710, 185, 58, "Approval", { pattern: "url(#hatch)", border: 5 })}
    ${pill(465, 710, 185, 58, "Cost")}
    ${pill(685, 710, 185, 58, "Outcome")}
    ${pill(905, 710, 185, 58, "Rollback", { pattern: "url(#hatch)", border: 5 })}
    ${pill(1125, 710, 185, 58, "Gaps", { pattern: "url(#crosshatch)", border: 5 })}
    <rect x="278" y="850" width="1044" height="60" fill="${ink.black}"/>
    ${text(800, 889, "Every unknown field is a governance gap.", { size: 28, weight: 850, fill: ink.paper })}
  </g>`,
    }),
  },
  {
    file: "figure-3-amina-inside-sam-monochrome",
    title: "Workbook figure. A.M.I.N.A. inside SAM",
    svg: svgWrap({
      title: "A.M.I.N.A. Inside SAM",
      subtitle: "The workbook habit that keeps acceleration governed.",
      body: `
  <g>
    <circle cx="800" cy="510" r="250" fill="${ink.paper}" stroke="${ink.black}" stroke-width="7"/>
    <circle cx="800" cy="510" r="112" fill="${ink.black}"/>
    ${text(800, 492, "SAM", { size: 42, weight: 900, fill: ink.paper })}
    ${text(800, 528, "Signals", { size: 17, weight: 700, fill: ink.paper })}
    ${text(800, 552, "Alignment  Momentum", { size: 17, weight: 700, fill: ink.paper })}
    ${pill(685, 200, 230, 64, "Align the work")}
    ${pill(1045, 390, 260, 64, "Map authority")}
    ${pill(960, 735, 300, 64, "Instrument receipt", { pattern: "url(#dots)" })}
    ${pill(345, 735, 300, 64, "Negotiate gate", { pattern: "url(#hatch)", border: 5 })}
    ${pill(295, 390, 260, 64, "Audit outcome")}
    ${arrow(878, 260, 1045, 405)}
    ${arrow(1110, 460, 1035, 735)}
    ${arrow(960, 770, 645, 770)}
    ${arrow(460, 735, 400, 455)}
    ${arrow(555, 405, 685, 245)}
    ${text(800, 880, "Align. Map. Instrument. Negotiate. Audit.", { size: 30, weight: 900 })}
  </g>`,
    }),
  },
  {
    file: "figure-8-1-portfolio-first-stack-monochrome",
    title: "Figure 8.1. Portfolio-first operating stack",
    svg: svgWrap({
      title: "Portfolio-First Operating Stack",
      subtitle: "The owned corpus becomes memory, roles, controls, cockpit, and public-safe proof.",
      body: `
  <g>
    ${stackRow(390, 172, 820, 92, "Owned portfolio and corpus", "public, client-safe, internal, private", "plain")}
    ${stackRow(390, 280, 820, 92, "Open Brain", "sources, events, proposals, memories", "dots")}
    ${stackRow(390, 388, 820, 92, "Harness", "Codex, tools, browser, apps, worktrees", "plain")}
    ${stackRow(390, 496, 820, 92, "Agent roles", "Shaka, Amina, specialist lanes", "light")}
    ${stackRow(390, 604, 820, 92, "Controls", "receipts, approvals, evals, drift checks", "hatch")}
    ${stackRow(390, 712, 820, 92, "Mission Control", "inspect, route, approve, recover", "dots")}
    ${stackRow(390, 820, 820, 92, "Public-safe proof", "exports without raw private logs", "plain")}
    ${arrow(1248, 210, 1248, 315, { width: 4 })}
    ${arrow(1248, 318, 1248, 423, { width: 4 })}
    ${arrow(1248, 426, 1248, 531, { width: 4 })}
    ${arrow(1248, 534, 1248, 639, { width: 4 })}
    ${arrow(1248, 642, 1248, 747, { width: 4 })}
    ${arrow(1248, 750, 1248, 855, { width: 4 })}
    <rect x="96" y="445" width="210" height="120" fill="${ink.black}"/>
    ${multiline(201, 492, ["Portfolio", "came first"], { size: 24, weight: 850, fill: ink.paper })}
    <rect x="1294" y="445" width="210" height="120" fill="url(#hatch)" stroke="${ink.black}" stroke-width="5"/>
    ${multiline(1399, 486, ["No raw", "private logs"], { size: 24, weight: 850 })}
  </g>`,
    }),
  },
  {
    file: "figure-ii-1-authority-ladder-monochrome",
    title: "Figure II.1. Authority ladder",
    svg: svgWrap({
      title: "Authority Ladder",
      subtitle: "Authority climbs only when evidence climbs with it.",
      body: `
  <g>
    ${card(120, 230, 250, 155, "Prepare", ["draft, summarize,", "classify"], { tone: "plain" })}
    ${card(410, 230, 250, 155, "Recommend", ["suggest next action", "with evidence"], { tone: "plain" })}
    ${card(700, 230, 250, 155, "Route", ["move work to the", "right human lane"], { tone: "dots" })}
    ${card(990, 230, 250, 155, "Stage", ["prepare external", "action for review"], { tone: "hatch" })}
    ${card(1280, 230, 250, 155, "Execute", ["only after", "explicit authority"], { tone: "hatch" })}
    ${arrow(370, 307, 410, 307)}
    ${arrow(660, 307, 700, 307)}
    ${arrow(950, 307, 990, 307)}
    ${arrow(1240, 307, 1280, 307)}
    ${pill(440, 520, 230, 64, "Receipt required", { pattern: "url(#dots)" })}
    ${pill(730, 620, 230, 64, "Source check", { pattern: "url(#dots)" })}
    ${pill(1020, 720, 230, 64, "Human gate", { pattern: "url(#hatch)", border: 5 })}
    ${pill(1290, 820, 230, 64, "Rollback path", { pattern: "url(#crosshatch)", border: 5 })}
    ${arrow(535, 385, 535, 520, { dash: "8 8", width: 4, marker: "arrowLight" })}
    ${arrow(825, 385, 825, 620, { dash: "8 8", width: 4, marker: "arrowLight" })}
    ${arrow(1115, 385, 1115, 720, { dash: "8 8", width: 4, marker: "arrowLight" })}
    ${arrow(1405, 385, 1405, 820, { dash: "8 8", width: 4, marker: "arrowLight" })}
    <rect x="142" y="830" width="820" height="64" fill="${ink.black}"/>
    ${text(552, 872, "The higher the side effect, the stronger the gate.", { size: 28, weight: 850, fill: ink.paper })}
  </g>`,
    }),
  },
];

for (const figure of figures) {
  const svgPath = join(svgDir, `${figure.file}.svg`);
  const pngPath = join(pngDir, `${figure.file}-600dpi.png`);
  const tiffPath = join(tiffDir, `${figure.file}-600dpi.tiff`);
  const reviewPath = join(reviewDir, `${figure.file}-review.png`);

  writeFileSync(svgPath, figure.svg, "utf8");

  await sharp(svgPath, { density: 600 })
    .resize({ width: 3300 })
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 600 })
    .toFile(pngPath);

  await sharp(svgPath, { density: 600 })
    .resize({ width: 3300 })
    .tiff({ compression: "lzw" })
    .withMetadata({ density: 600 })
    .toFile(tiffPath);

  await sharp(svgPath)
    .png({ compressionLevel: 9 })
    .toFile(reviewPath);
}

const pages = figures
  .map((figure) => {
    const src = pathToFileURL(join(pngDir, `${figure.file}-600dpi.png`)).href;
    return `<section class="page">
      <img src="${src}" alt="${esc(figure.title)}" />
      <p>${esc(figure.title)}</p>
    </section>`;
  })
  .join("\n");

const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: 6in 9in; margin: 0.5in 0.25in; }
    body {
      margin: 0;
      font-family: Avenir Next, Inter, Arial, sans-serif;
      color: #111111;
      background: white;
    }
    .page {
      break-after: page;
      page-break-after: always;
      min-height: 8in;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 0.18in;
    }
    .page:last-child {
      break-after: auto;
      page-break-after: auto;
    }
    img {
      width: 5.5in;
      height: auto;
      display: block;
    }
    p {
      margin: 0;
      font-size: 9pt;
      line-height: 1.25;
      color: #333333;
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.pdf({
  path: join(proofDir, "agentified-monochrome-figure-proof-6x9.pdf"),
  width: "6in",
  height: "9in",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

console.log(`Rendered monochrome SVG assets to ${svgDir}`);
console.log(`Rendered monochrome PNG print masters to ${pngDir}`);
console.log(`Rendered monochrome TIFF print masters to ${tiffDir}`);
console.log(`Rendered monochrome review PNG assets to ${reviewDir}`);
console.log(`Rendered monochrome 6x9 proof PDF to ${join(proofDir, "agentified-monochrome-figure-proof-6x9.pdf")}`);
