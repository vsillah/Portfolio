import fs from 'node:fs/promises'
import path from 'node:path'
const root = process.cwd()
const qa = path.join(root, 'docs/qa/services-theme-speaking-visuals')
const map = JSON.parse(await fs.readFile(path.join(root, 'docs/qa/workshop-editorial-color-2026-11-02/source-to-service-visual-map.json'), 'utf8'))
const files = ['asset-inventory.json', 'generation-source-map.json', 'service-gallery-audit.json', 'workshop-casting-matrix.json']
const [inventory, sources, audit, matrix] = await Promise.all(files.map(async (name) => JSON.parse(await fs.readFile(path.join(qa, name), 'utf8'))))
for (const row of map.frames) {
  const keyed = (item) => item.slug === row.slug && item.role === row.role
  const items = [inventory.find(keyed), sources.generated.find(keyed), audit.find((item) => item.slug === row.slug)?.frames.find(keyed), matrix.assets.find(keyed)]
  if (items.some((item) => !item)) throw new Error(`Missing gallery binding ${row.slug}:${row.role}`)
  items[0].sha256 = items[2].sha256 = row.outputSha256
  for (const item of items) {
    item.analysisSourcePath = row.source
    item.analysisSourceSha256 = row.sourceSha256
    item.analysisSourceMember = row.member
    item.analysisFramework = row.framework
    item.analysisChapter = row.chapter
    item.analysisArtifactPath = row.artifactPath
    item.analysisArtifactSha256 = row.artifactSha256
    item.analysisCompositeMethod = row.compositeMethod
    item.analysisOutputSha256 = row.outputSha256
  }
}
await Promise.all(files.map((name, index) => fs.writeFile(path.join(qa, name), JSON.stringify([inventory, sources, audit, matrix][index], null, 2) + '\n')))
