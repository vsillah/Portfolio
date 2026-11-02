import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const qaDir = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(qaDir, '../../..');
const destination = path.join(root, 'public/showcases/service-photographic');
const sources = JSON.parse(await fs.readFile(path.join(qaDir, 'generation-source-map.json'), 'utf8'));
const inventory = [];
await fs.mkdir(destination, { recursive: true });

async function save({ slug, role, source, extract }) {
  const output = path.join(destination, `${slug}-${role}.jpg`);
  let image = sharp(source);
  if (extract) image = image.extract(extract);
  await image.jpeg({ quality: 85, mozjpeg: true }).toFile(output);
  const buffer = await fs.readFile(output);
  const metadata = await sharp(buffer).metadata();
  inventory.push({
    slug, role,
    imageUrl: `/showcases/service-photographic/${slug}-${role}.jpg`,
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    width: metadata.width,
    height: metadata.height,
    source,
    ...(extract ? { extract } : {}),
  });
}

for (const item of sources.generated) {
  await save({ slug: item.slug, role: item.role, source: item.path });
}
for (const item of sources.sheets) {
  const metadata = await sharp(item.path).metadata();
  if (metadata.width !== 2172 || metadata.height !== 724) {
    throw new Error(`${item.slug}: contact sheet dimensions changed (${metadata.width}×${metadata.height}); inspect crop before using`);
  }
  await save({ slug: item.slug, role: 'hero', source: item.path, extract: { left: 0, top: 50, width: 1075, height: 625 } });
  await save({ slug: item.slug, role: 'secondary', source: item.path, extract: { left: 1097, top: 50, width: 1075, height: 625 } });
}
const keys = new Set(inventory.map(item => `${item.slug}:${item.role}`));
if (inventory.length !== 60 || keys.size !== 60 || new Set(inventory.map(item => item.sha256)).size !== 60) {
  throw new Error(`Expected 60 unique final frames; found ${inventory.length} frames and ${keys.size} keys`);
}
await fs.writeFile(path.join(qaDir, 'asset-inventory.json'), `${JSON.stringify(inventory.sort((a, b) => a.slug.localeCompare(b.slug) || a.role.localeCompare(b.role)), null, 2)}\n`);
console.log(`Prepared ${inventory.length} distinct JPEGs for 30 replacement galleries`);
