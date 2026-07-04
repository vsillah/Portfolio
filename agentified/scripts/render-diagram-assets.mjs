#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const outDir = "/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered";
const printDir = join(outDir, "print");
const colorPrintDir = join(printDir, "color-600dpi");
const grayscalePrintDir = join(printDir, "grayscale-600dpi");
const grayscalePreviewDir = join(printDir, "grayscale-preview-png");
mkdirSync(outDir, { recursive: true });
mkdirSync(colorPrintDir, { recursive: true });
mkdirSync(grayscalePrintDir, { recursive: true });
mkdirSync(grayscalePreviewDir, { recursive: true });

const colors = {
  navy: "#111827",
  navy2: "#172033",
  paper: "#F8F5EE",
  paper2: "#EFE8D8",
  gold: "#C79A3B",
  gold2: "#E2C46F",
  teal: "#2A8C82",
  teal2: "#DDEFEA",
  red: "#B65A4A",
  red2: "#F4DFDA",
  ink: "#1F2937",
  muted: "#5B6472",
  line: "#D8C9A8",
  white: "#FFFFFF",
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
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.18"/>
    </filter>
    <marker id="arrowGold" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,6 L2,10 Z" fill="${colors.gold}"/>
    </marker>
    <marker id="arrowTeal" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,6 L2,10 Z" fill="${colors.teal}"/>
    </marker>
    <marker id="arrowInk" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="strokeWidth">
      <path d="M2,2 L10,6 L2,10 Z" fill="${colors.ink}"/>
    </marker>
  </defs>
  <rect width="${width}" height="${height}" fill="${colors.navy}"/>
  <rect x="34" y="34" width="${width - 68}" height="${height - 68}" rx="22" fill="${colors.paper}" stroke="${colors.gold}" stroke-width="4"/>
  <text x="${width / 2}" y="88" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="42" font-weight="800" fill="${colors.ink}">${esc(title)}</text>
  <text x="${width / 2}" y="130" text-anchor="middle" font-family="Avenir Next, Inter, Arial, sans-serif" font-size="22" fill="${colors.muted}">${esc(subtitle)}</text>
  ${body}
</svg>
`;
}

function text(x, y, value, { size = 24, weight = 600, fill = colors.ink, anchor = "middle", family = "Avenir Next, Inter, Arial, sans-serif" } = {}) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(value)}</text>`;
}

function multiline(x, y, lines, opts = {}) {
  const size = opts.size ?? 22;
  const gap = opts.gap ?? Math.round(size * 1.3);
  return lines.map((line, idx) => text(x, y + idx * gap, line, opts)).join("\n");
}

function card(x, y, w, h, title, lines, { fill = colors.white, stroke = colors.line, titleFill = colors.ink, accent = colors.gold, titleSize = 25 } = {}) {
  return `
  <g filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <rect x="${x}" y="${y}" width="${w}" height="12" rx="6" fill="${accent}"/>
    ${text(x + w / 2, y + 52, title, { size: titleSize, weight: 800, fill: titleFill })}
    ${multiline(x + w / 2, y + 88, lines, { size: 19, weight: 500, fill: colors.muted })}
  </g>`;
}

function arrow(x1, y1, x2, y2, { color = colors.gold, width = 5, marker = "arrowGold", dash = "" } = {}) {
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"${dashAttr} marker-end="url(#${marker})"/>`;
}

function pill(x, y, w, h, label, { fill = colors.teal2, stroke = colors.teal, txt = colors.ink, size = 19 } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
  ${text(x + w / 2, y + h / 2 + 7, label, { size, weight: 700, fill: txt })}`;
}

function stackRow(x, y, w, h, title, subtitle, accent = colors.gold) {
  return `
  <g filter="url(#shadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${colors.white}" stroke="${colors.line}" stroke-width="3"/>
    <rect x="${x}" y="${y}" width="${w}" height="12" rx="6" fill="${accent}"/>
    ${text(x + w / 2, y + 42, title, { size: 24, weight: 850 })}
    ${text(x + w / 2, y + 72, subtitle, { size: 18, weight: 500, fill: colors.muted })}
  </g>`;
}

const renderedSvgs = [];

function write(name, content) {
  const path = join(outDir, name);
  writeFileSync(path, content, "utf8");
  renderedSvgs.push(path);
}

write("figure-0-1-sam-trust-layer.svg", svgWrap({
  title: "SAM with the Trust Layer",
  subtitle: "Agentified builds on \"Accelerated\": speed becomes capacity when the evidence moves with the work.",
  body: `
  <g>
    ${card(90, 210, 430, 280, "Signals", ["Raw noise", "to clear signal"], { accent: colors.gold })}
    ${card(585, 210, 430, 280, "Alignment", ["Insight", "to shared direction"], { accent: colors.gold })}
    ${card(1080, 210, 430, 280, "Momentum", ["Systems", "that compound"], { accent: colors.gold })}
    ${arrow(520, 350, 585, 350)}
    ${arrow(1015, 350, 1080, 350)}
    ${text(800, 545, "Agentified adds the trust layer", { size: 28, weight: 800, fill: colors.ink })}
    ${pill(135, 620, 210, 72, "Source")}
    ${pill(390, 620, 210, 72, "Receipt")}
    ${pill(645, 620, 210, 72, "Gate", { fill: colors.red2, stroke: colors.red })}
    ${pill(900, 620, 210, 72, "Eval")}
    ${pill(1155, 620, 210, 72, "Proof")}
    ${arrow(345, 656, 390, 656, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(600, 656, 645, 656, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(855, 656, 900, 656, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1110, 656, 1155, 656, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(305, 500, 235, 610, { color: colors.red, marker: "arrowInk", dash: "10 10", width: 4 })}
    ${arrow(800, 500, 750, 610, { color: colors.red, marker: "arrowInk", dash: "10 10", width: 4 })}
    ${arrow(1295, 500, 1005, 610, { color: colors.red, marker: "arrowInk", dash: "10 10", width: 4 })}
    ${text(235, 740, "What did it read?", { size: 18, fill: colors.muted })}
    ${text(750, 740, "Who approves?", { size: 18, fill: colors.muted })}
    ${text(1005, 740, "Did it work?", { size: 18, fill: colors.muted })}
    <rect x="176" y="805" width="1248" height="78" rx="18" fill="${colors.navy2}"/>
    ${text(800, 855, "SAM creates acceleration. The trust layer makes acceleration governable.", { size: 30, weight: 800, fill: colors.gold2 })}
  </g>`
}));

write("figure-1-1-first-receipt.svg", svgWrap({
  title: "The First Receipt",
  subtitle: "A visible envelope around an agent action, before authority expands.",
  body: `
  <g>
    ${card(90, 230, 300, 170, "Agent run", ["Drafts or", "recommends work"], { accent: colors.gold })}
    ${card(470, 230, 300, 170, "Receipt envelope", ["Evidence travels", "with the output"], { accent: colors.teal })}
    ${card(850, 230, 300, 170, "Human gate", ["Approve, hold,", "or reject"], { accent: colors.red })}
    ${card(1230, 230, 300, 170, "Outcome", ["Ship, revise,", "or rollback"], { accent: colors.gold })}
    ${arrow(390, 315, 470, 315)}
    ${arrow(770, 315, 850, 315)}
    ${arrow(1150, 315, 1230, 315)}
    <rect x="192" y="520" width="1216" height="300" rx="24" fill="${colors.teal2}" stroke="${colors.teal}" stroke-width="3"/>
    ${text(800, 570, "Inside the receipt", { size: 30, weight: 800, fill: colors.ink })}
    ${pill(245, 620, 185, 58, "Intent", { fill: colors.white })}
    ${pill(465, 620, 185, 58, "Agent", { fill: colors.white })}
    ${pill(685, 620, 185, 58, "Source", { fill: colors.white })}
    ${pill(905, 620, 185, 58, "Action", { fill: colors.white })}
    ${pill(1125, 620, 185, 58, "Artifact", { fill: colors.white })}
    ${pill(245, 710, 185, 58, "Approval", { fill: colors.white, stroke: colors.red })}
    ${pill(465, 710, 185, 58, "Cost", { fill: colors.white })}
    ${pill(685, 710, 185, 58, "Outcome", { fill: colors.white })}
    ${pill(905, 710, 185, 58, "Rollback", { fill: colors.white, stroke: colors.red })}
    ${pill(1125, 710, 185, 58, "Gaps", { fill: colors.red2, stroke: colors.red })}
    <rect x="278" y="850" width="1044" height="60" rx="18" fill="${colors.navy2}"/>
    ${text(800, 889, "Every unknown field is a governance gap.", { size: 28, weight: 800, fill: colors.gold2 })}
  </g>`
}));

write("figure-3-amina-inside-sam.svg", svgWrap({
  title: "A.M.I.N.A. Inside SAM",
  subtitle: "The workbook habit that keeps acceleration governed.",
  body: `
  <g>
    <circle cx="800" cy="510" r="250" fill="${colors.white}" stroke="${colors.gold}" stroke-width="6" filter="url(#shadow)"/>
    <circle cx="800" cy="510" r="112" fill="${colors.navy2}"/>
    ${text(800, 492, "SAM", { size: 42, weight: 900, fill: colors.gold2 })}
    ${text(800, 528, "Signals", { size: 17, weight: 700, fill: colors.paper2 })}
    ${text(800, 552, "Alignment  Momentum", { size: 17, weight: 700, fill: colors.paper2 })}
    ${pill(685, 200, 230, 64, "Align the work", { fill: colors.white })}
    ${pill(1045, 390, 260, 64, "Map authority", { fill: colors.white })}
    ${pill(960, 735, 300, 64, "Instrument receipt", { fill: colors.white })}
    ${pill(345, 735, 300, 64, "Negotiate gate", { fill: colors.red2, stroke: colors.red })}
    ${pill(295, 390, 260, 64, "Audit outcome", { fill: colors.white })}
    ${arrow(878, 260, 1045, 405, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1110, 460, 1035, 735, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(960, 770, 645, 770, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(460, 735, 400, 455, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(555, 405, 685, 245, { color: colors.teal, marker: "arrowTeal" })}
    ${text(800, 880, "Align. Map. Instrument. Negotiate. Audit.", { size: 30, weight: 900, fill: colors.ink })}
  </g>`
}));

write("figure-8-1-portfolio-first-stack.svg", svgWrap({
  title: "Portfolio-First Operating Stack",
  subtitle: "The owned corpus becomes memory, roles, controls, cockpit, and public-safe proof.",
  body: `
  <g>
    ${stackRow(390, 172, 820, 92, "Owned portfolio and corpus", "public, client-safe, internal, private", colors.gold)}
    ${stackRow(390, 280, 820, 92, "Open Brain", "sources, events, proposals, memories", colors.teal)}
    ${stackRow(390, 388, 820, 92, "Harness", "Codex, tools, browser, apps, worktrees", colors.gold)}
    ${stackRow(390, 496, 820, 92, "Agent roles", "Shaka, Amina, specialist lanes", colors.teal)}
    ${stackRow(390, 604, 820, 92, "Controls", "receipts, approvals, evals, drift checks", colors.red)}
    ${stackRow(390, 712, 820, 92, "Mission Control", "inspect, route, approve, recover", colors.teal)}
    ${stackRow(390, 820, 820, 92, "Public-safe proof", "exports without raw private logs", colors.gold)}
    ${arrow(1248, 210, 1248, 315, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1248, 318, 1248, 423, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1248, 426, 1248, 531, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1248, 534, 1248, 639, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1248, 642, 1248, 747, { color: colors.teal, marker: "arrowTeal" })}
    ${arrow(1248, 750, 1248, 855, { color: colors.teal, marker: "arrowTeal" })}
    <rect x="96" y="445" width="210" height="120" rx="18" fill="${colors.navy2}"/>
    ${multiline(201, 492, ["Portfolio", "came first"], { size: 24, weight: 850, fill: colors.gold2 })}
    <rect x="1294" y="445" width="210" height="120" rx="18" fill="${colors.red2}" stroke="${colors.red}" stroke-width="3"/>
    ${multiline(1399, 486, ["No raw", "private logs"], { size: 24, weight: 850, fill: colors.red })}
  </g>`
}));

write("figure-ii-1-authority-ladder.svg", svgWrap({
  title: "Authority Ladder",
  subtitle: "Authority climbs only when evidence climbs with it.",
  body: `
  <g>
    ${card(120, 230, 250, 155, "Prepare", ["draft, summarize,", "classify"], { accent: colors.gold })}
    ${card(410, 230, 250, 155, "Recommend", ["suggest next action", "with evidence"], { accent: colors.gold })}
    ${card(700, 230, 250, 155, "Route", ["move work to the", "right human lane"], { accent: colors.teal })}
    ${card(990, 230, 250, 155, "Stage", ["prepare external", "action for review"], { accent: colors.red })}
    ${card(1280, 230, 250, 155, "Execute", ["only after", "explicit authority"], { accent: colors.red })}
    ${arrow(370, 307, 410, 307)}
    ${arrow(660, 307, 700, 307)}
    ${arrow(950, 307, 990, 307)}
    ${arrow(1240, 307, 1280, 307)}
    ${pill(440, 520, 230, 64, "Receipt required", { fill: colors.teal2 })}
    ${pill(730, 620, 230, 64, "Source check", { fill: colors.teal2 })}
    ${pill(1020, 720, 230, 64, "Human gate", { fill: colors.red2, stroke: colors.red })}
    ${pill(1290, 820, 230, 64, "Rollback path", { fill: colors.red2, stroke: colors.red })}
    ${arrow(535, 385, 535, 520, { color: colors.teal, marker: "arrowTeal", dash: "8 8", width: 4 })}
    ${arrow(825, 385, 825, 620, { color: colors.teal, marker: "arrowTeal", dash: "8 8", width: 4 })}
    ${arrow(1115, 385, 1115, 720, { color: colors.red, marker: "arrowInk", dash: "8 8", width: 4 })}
    ${arrow(1405, 385, 1405, 820, { color: colors.red, marker: "arrowInk", dash: "8 8", width: 4 })}
    <rect x="142" y="830" width="820" height="64" rx="18" fill="${colors.navy2}"/>
    ${text(552, 872, "The higher the side effect, the stronger the gate.", { size: 28, weight: 850, fill: colors.gold2 })}
  </g>`
}));

for (const svgPath of renderedSvgs) {
  const pngPath = svgPath.replace(/\.svg$/, ".png");
  await sharp(svgPath).png().toFile(pngPath);

  const base = basename(svgPath, ".svg");
  const colorPrintPath = join(colorPrintDir, `${base}-print-600dpi.png`);
  const grayscalePrintPath = join(grayscalePrintDir, `${base}-grayscale-600dpi.tiff`);
  const grayscalePreviewPath = join(grayscalePreviewDir, `${base}-grayscale-preview.png`);

  await sharp(svgPath, { density: 600 })
    .resize({ width: 3300 })
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 600 })
    .toFile(colorPrintPath);

  await sharp(svgPath, { density: 600 })
    .resize({ width: 3300 })
    .grayscale()
    .tiff({ compression: "lzw" })
    .withMetadata({ density: 600 })
    .toFile(grayscalePrintPath);

  await sharp(svgPath)
    .grayscale()
    .png({ compressionLevel: 9 })
    .toFile(grayscalePreviewPath);
}

console.log(`Rendered SVG and PNG diagram assets to ${outDir}`);
console.log(`Rendered print color PNG assets to ${colorPrintDir}`);
console.log(`Rendered grayscale TIFF proof assets to ${grayscalePrintDir}`);
console.log(`Rendered grayscale PNG preview assets to ${grayscalePreviewDir}`);
