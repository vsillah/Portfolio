import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'

export const ORIGINAL_GENERATOR_SHA256 = '11293afa1c27c945e527e79c96268a1c6545bf697f937b00eeca6ab2710752fd'
export const ORIGINAL_RENDER_RECEIPT_SHA256 = '1f2ac83fc5fd53e86249b92db3006c9f5a8c5ee576f38afc9e373abb1a8f5b8a'
export const SOURCE_MANIFEST_SHA256 = '6cc68cc04befaeee4e946db98c3610d3152e5cec56dc63fa6f1b00047ba34297'

export const SOURCE_SHA256 = Object.freeze({
  'drive/canonical-sam-framework.png': 'eb3d4fab5320d9d1233989ab8587c6856792793ecff538db69f3e648acb4a42d',
  'live/decision-file-empty.png': '0a05a03c8af3d4e87423f237b0d0aa9bb6f8b5135fbee0b696546c8bfc878877',
  'live/learning-plan-public.png': '40f7499a9d28aa5153b62fee0960869a2a28f956a2d2795aaabf7a32d933de89',
  'repo/public/accelerated/posters/l01-poster.webp': 'bd83a117c1c80c7579b9b25b7da5f63c95e462a5a0808d58b1a66acb7e27d72d',
  'repo/public/accelerated/posters/l12-poster-desktop-53dd8b6f8e15.webp': '53dd8b6f8e15f1b95e1fbe1a4a2a54a84abac332a38c108109d564321bca2a3d',
  'repo/public/amadutown-logo-upscaled.png': '42ea112b3079301524e102696a6d7db0d8700323fe924b6725ad8badee32a165',
  'repo/public/showcases/service-prototypes/accelerated-sam-infographic.png': '13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6',
  'repo/public/showcases/service-prototypes/v2/sam-alignment-plate.webp': '82b9fd4429387182e4fab545ecd11a3cd7174794fd9c9b0f9fbda6606b4c72a0',
  'repo/public/showcases/service-prototypes/v2/sam-momentum-plate.webp': '8b32de9f499e3fdefadcb847ac1032dac27405f74fde844af9c53ae1b4a5d2d3',
  'repo/public/showcases/service-prototypes/v2/sam-signals-plate.webp': '8554d40fb4e5471c61c7c3e530da80bfa07c7a77ab34afb79eecfb9945985e6c',
})

export async function sha256(file) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex')
}

export async function verifySourceBindings(root) {
  const checks = [
    [path.join(root, 'render-receipt.json'), ORIGINAL_RENDER_RECEIPT_SHA256],
    ...Object.entries(SOURCE_SHA256).map(([relative, hash]) => [path.join(root, 'sources', relative), hash]),
  ]
  for (const [file, expected] of checks) {
    const actual = await sha256(file)
    if (actual !== expected) throw new Error(`Source binding drift: ${file} expected ${expected}, got ${actual}`)
  }
  return checks.map(([file, expected]) => ({ path: path.relative(process.cwd(), file), sha256: expected }))
}
