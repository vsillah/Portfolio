import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { validate } from './validate-v1.mjs'

const bundle = resolve(dirname(fileURLToPath(import.meta.url)), 'v1')
const candidate = () => JSON.parse(readFileSync(resolve(bundle, 'manifest.json'), 'utf8'))

test('frozen audit package is review-only and hash-bound', () => {
  assert.deepEqual(validate(), { status: 'review_only_incomplete_unsubmitted', errors: [] })
})

test('rejects a missing gap or promoted external action', () => {
  const changed = candidate()
  changed.unresolved_required_evidence.pop()
  changed.provider_write = true
  assert.equal(validate(changed).status, 'blocked')
  assert.ok(validate(changed).errors.includes('Required evidence gap was hidden'))
  assert.ok(validate(changed).errors.includes('provider_write was promoted'))
})

test('rejects changed evidence bytes or source binding', () => {
  const changed = candidate()
  changed.files[0].sha256 = '0'.repeat(64)
  changed.source_sha256['app/legal/privacy/page.tsx'] = '0'.repeat(64)
  assert.ok(validate(changed).errors.includes('Artifact hash/size drift: privacy-policy-public-route.jpg'))
  assert.ok(validate(changed).errors.includes('Source hash drift: app/legal/privacy/page.tsx'))
})
