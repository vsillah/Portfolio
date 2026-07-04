#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = "/Users/vambahsillah/Projects/Portfolio/agentified";
const source = join(root, "source-assets/accelerated/accelerated-sam-infographic.png");
const printRoot = join(root, "manuscript/visuals/rendered/print");
const colorDir = join(printRoot, "color-600dpi");
const grayscaleDir = join(printRoot, "grayscale-600dpi");
const grayscalePreviewDir = join(printRoot, "grayscale-preview-png");

for (const dir of [colorDir, grayscaleDir, grayscalePreviewDir]) {
  mkdirSync(dir, { recursive: true });
}

await sharp(source, { density: 600 })
  .resize({ width: 3300 })
  .png({ compressionLevel: 9 })
  .withMetadata({ density: 600 })
  .toFile(join(colorDir, "figure-0-0-accelerated-sam-loop-print-600dpi.png"));

await sharp(source, { density: 600 })
  .resize({ width: 3300 })
  .grayscale()
  .tiff({ compression: "lzw" })
  .withMetadata({ density: 600 })
  .toFile(join(grayscaleDir, "figure-0-0-accelerated-sam-loop-grayscale-600dpi.tiff"));

await sharp(source)
  .grayscale()
  .png({ compressionLevel: 9 })
  .toFile(join(grayscalePreviewDir, "figure-0-0-accelerated-sam-loop-grayscale-preview.png"));

console.log(join(colorDir, "figure-0-0-accelerated-sam-loop-print-600dpi.png"));
