import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { deterministicVisualBindingQaFixture } from '@/lib/social-deterministic-visual-qa-fixture'
import {
  bufferSha256,
  readDeterministicVisualSpec,
} from '@/lib/social-deterministic-visual'
import {
  loadAmaduTownLogoPng,
  renderDeterministicVisualPng,
} from '@/lib/social-deterministic-visual-renderer'

async function main() {
  const fixture = deterministicVisualBindingQaFixture('ready')
  const spec = readDeterministicVisualSpec(fixture.rag_context)
  if (!spec) throw new Error('The deterministic visual QA fixture has no renderable specification.')

  const outputPath = path.join(
    process.cwd(),
    'public',
    'qa',
    'social-content',
    'deterministic-visual-binding.png',
  )
  const png = await renderDeterministicVisualPng({
    spec,
    visualType: fixture.framework_visual_type!,
    logoPng: await loadAmaduTownLogoPng(),
  })
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, png)
  console.log(JSON.stringify({
    output_path: path.relative(process.cwd(), outputPath),
    bytes: png.length,
    sha256: bufferSha256(png),
    provider: 'none',
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
