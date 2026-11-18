import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { layoutPanel, PANEL_PADDING, measureLine } from './panel-layout.mjs'
import { verifySourceBindings, sha256, ORIGINAL_GENERATOR_SHA256 } from './source-bindings.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))

test('content sets plate dimensions with 28px padding', async () => {
  const short = await layoutPanel({ title: 'Signals', maxWidth: 430 })
  const long = await layoutPanel({ title: 'The person responsible for the next move.', body: 'Keep the questions, evidence, tradeoffs, owner, and next move together.', maxWidth: 430 })
  assert.equal(PANEL_PADDING, 28)
  assert.ok(short.height < 150, `short plate is too tall: ${short.height}`)
  assert.ok(long.height > short.height)
  assert.ok(short.width < 430)
  assert.ok(long.width <= 430)
  for (const panel of [short, long]) {
    for (const line of panel.titleLines) assert.ok(await measureLine(line, panel.titleSize, panel.titleFamily, 700) + 2 * PANEL_PADDING <= panel.width)
    for (const line of panel.bodyLines) assert.ok(await measureLine(line, panel.bodySize, panel.bodyFamily, 500) + 2 * PANEL_PADDING <= panel.width)
    assert.ok(panel.height > panel.titleY + PANEL_PADDING)
  }
})

test('approved copy and source bindings remain unchanged', async () => {
  const original = await fs.readFile(path.join(root, 'sources/original-generator-v1.txt'), 'utf8')
  const current = await fs.readFile(path.join(root, 'generate-review-assets.mjs'), 'utf8')
  assert.equal(await sha256(path.join(root, 'sources/original-generator-v1.txt')), ORIGINAL_GENERATOR_SHA256)
  const copy = (text) => [...text.matchAll(/\{ title: '([^']*)'(?:, body: '([^']*)')?/g)].map(([, title, body]) => [title, body ?? ''])
  assert.deepEqual(copy(current), copy(original))
  assert.equal(copy(current).length, 40)
  for (const literal of ['ONE DECISION.', 'ONE WORKING FILE.', 'SIGNALS · ALIGNMENT · MOMENTUM', 'amadutown.com/accelerated']) {
    assert.ok(current.includes(literal))
  }
  await verifySourceBindings(root)
  const originalReceipt = JSON.parse(await fs.readFile(path.join(root, 'render-receipt.json'), 'utf8'))
  for (const output of originalReceipt.outputs) {
    assert.equal(await sha256(path.resolve(output.path)), output.sha256, `Original review asset changed: ${output.path}`)
  }
})

test('review generator writes only to the separate content-fit package', async () => {
  const current = await fs.readFile(path.join(root, 'generate-review-assets.mjs'), 'utf8')
  assert.ok(current.includes("const output = path.join(root, 'review-assets-content-fit')"))
  assert.ok(current.includes("path.join(root, 'render-receipt-content-fit.json')"))
  assert.ok(!current.includes('capturePublicSources()'))
  assert.ok(!current.includes('public/campaigns/accelerated/2026-11'))
})
