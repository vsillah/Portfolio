#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";

const root = "/Users/vambahsillah/Projects/Portfolio/agentified";
const proofDir = join(root, "manuscript/visuals/rendered/print/proofs");
mkdirSync(proofDir, { recursive: true });

const figures = [
  {
    title: "Figure 0.0. The original SAM loop from \"Accelerated\"",
    file: "figure-0-0-accelerated-sam-loop-print-600dpi.png",
  },
  {
    title: "Figure 0.1. SAM with the trust layer",
    file: "figure-0-1-sam-trust-layer-print-600dpi.png",
  },
  {
    title: "Figure 1.1. The first receipt",
    file: "figure-1-1-first-receipt-print-600dpi.png",
  },
  {
    title: "Figure 8.1. Portfolio-first operating stack",
    file: "figure-8-1-portfolio-first-stack-print-600dpi.png",
  },
  {
    title: "Figure II.1. Authority ladder",
    file: "figure-ii-1-authority-ladder-print-600dpi.png",
  },
];

const imageDir = join(root, "manuscript/visuals/rendered/print/color-600dpi");
const pages = figures
  .map((figure) => {
    const src = pathToFileURL(join(imageDir, figure.file)).href;
    return `<section class="page">
      <img src="${src}" alt="${figure.title}" />
      <p>${figure.title}</p>
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
      color: #1f2937;
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
      color: #4b5563;
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
  path: join(proofDir, "agentified-print-figure-proof-6x9.pdf"),
  width: "6in",
  height: "9in",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

console.log(join(proofDir, "agentified-print-figure-proof-6x9.pdf"));
