import assert from 'node:assert/strict'
import { test } from 'node:test'
import { build } from 'esbuild'
import { fixtureHash as runtimeHash } from './receipt-primitives.mjs'
import { fixtureHash as replayHash } from './shadow-replay.mjs'

test('server shadow adapter bundles without CLI filesystem or retained-checkout modules', async () => {
  const result = await build({
    entryPoints: ['tools/evidence-repair/shadow-workflow-binding.mjs'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
  })
  const modules = Object.keys(result.metafile.inputs)
  const imports = Object.values(result.metafile.inputs).flatMap((input) => input.imports.map((entry) => entry.path))
  assert.ok(modules.some((path) => path.endsWith('decision-receipt-runtime.mjs')))
  assert.ok(modules.some((path) => path.endsWith('receipt-primitives.mjs')))
  assert.ok(!modules.some((path) => path.endsWith('shadow-replay.mjs') || path.endsWith('decision-receipt.mjs')))
  assert.ok(!imports.some((path) => ['node:fs', 'node:path', 'node:url', 'fs', 'path', 'url'].includes(path)))
  assert.ok(!result.outputFiles[0].text.includes('/Users/vambahsillah/Projects/Portfolio'))
})

test('runtime fixture hashing retains the Phase 5B byte contract', () => {
  const fixture = { case_id: 'synthetic:packaging', input: { version: 'v1' } }
  assert.equal(runtimeHash(fixture), replayHash(fixture))
})
