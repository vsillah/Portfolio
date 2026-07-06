#!/usr/bin/env node
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";

const root = dirname(dirname(new URL(import.meta.url).pathname));
const require = createRequire(import.meta.url);

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    const fallback = process.env.PORTFOLIO_NODE_MODULES
      ? join(process.env.PORTFOLIO_NODE_MODULES, "playwright")
      : resolve(root, "../../../Portfolio/node_modules/playwright");
    try {
      return require(fallback);
    } catch {
      throw error;
    }
  }
}

function loadSharp() {
  try {
    return require("sharp");
  } catch (error) {
    const fallback = process.env.PORTFOLIO_NODE_MODULES
      ? join(process.env.PORTFOLIO_NODE_MODULES, "sharp")
      : resolve(root, "../../../Portfolio/node_modules/sharp");
    try {
      return require(fallback);
    } catch {
      throw error;
    }
  }
}

const { chromium } = loadPlaywright();
const sharp = loadSharp();
const proofDir = join(root, "manuscript/visuals/rendered/print/proofs");
const tempDir = join("/tmp", "agentified-print-proof-assets");
mkdirSync(proofDir, { recursive: true });
rmSync(tempDir, { recursive: true, force: true });
mkdirSync(tempDir, { recursive: true });

const figures = [
  {
    title: "Figure 0.0. The original SAM loop from \"Accelerated\"",
    file: "manuscript/visuals/rendered/print/color-600dpi/figure-0-0-accelerated-sam-loop-print-600dpi.png",
  },
  {
    title: "Figure 0.1. SAM with the trust layer",
    file: "manuscript/visuals/rendered/publication-plates/figure-0-1-sam-trust-layer-publication-plate.png",
    orientation: "landscape",
  },
  {
    title: "Figure 1.1. The first receipt",
    file: "manuscript/visuals/rendered/publication-plates/figure-1-1-first-receipt-publication-plate.png",
    orientation: "landscape",
  },
  {
    title: "Workbook front matter. A.M.I.N.A. inside SAM",
    file: "manuscript/visuals/rendered/publication-plates/figure-3-amina-inside-sam-publication-plate.png",
  },
  {
    title: "Figure 8.1. Portfolio-first operating stack",
    file: "manuscript/visuals/rendered/publication-plates/figure-8-1-portfolio-first-stack-publication-plate.png",
    orientation: "landscape",
  },
  {
    title: "Figure II.1. Authority ladder",
    file: "manuscript/visuals/rendered/publication-plates/figure-ii-1-authority-ladder-publication-plate.png",
  },
];

const pages = (
  await Promise.all(figures.map(async (figure, index) => {
    const orientation = figure.orientation ?? "portrait";
    const sourcePath = join(root, figure.file);
    const reviewPath = join(tempDir, `figure-${index + 1}.jpg`);
    await sharp(sourcePath)
      .resize({
        width: orientation === "landscape" ? 2200 : 1600,
        withoutEnlargement: true,
      })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(reviewPath);
    const src = pathToFileURL(reviewPath).href;
    return `<section class="page ${orientation}">
      <div class="figure-frame ${orientation}">
        <img class="${orientation}" src="${src}" alt="${figure.title}" />
      </div>
      <p>${figure.title}</p>
    </section>`;
  }))
).join("\n");

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
    .figure-frame {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .figure-frame.portrait {
      width: 5.5in;
      max-height: 7.35in;
    }
    .figure-frame.landscape {
      width: 5.5in;
      height: 7.35in;
    }
    img.portrait {
      max-width: 5.5in;
      max-height: 7.35in;
      width: auto;
      height: auto;
      display: block;
    }
    img.landscape {
      width: 7.35in;
      height: auto;
      max-width: none;
      max-height: none;
      display: block;
      transform: rotate(90deg);
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
const htmlPath = join(tempDir, "agentified-print-figure-proof-6x9.html");
writeFileSync(htmlPath, html);
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.waitForFunction(() =>
  Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
);
await page.pdf({
  path: join(proofDir, "agentified-print-figure-proof-6x9.pdf"),
  width: "6in",
  height: "9in",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();

console.log(join(proofDir, "agentified-print-figure-proof-6x9.pdf"));
