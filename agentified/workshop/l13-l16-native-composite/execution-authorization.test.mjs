import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { AUTHORIZATION_PATH, AUTHORIZATION_SHA256, REQUESTS, validateAuthorization, validateAuthorizationBinding } from './execution-authorization.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const original = JSON.parse(readFileSync(path.join(here, 'execution-authorization-receipt.json')))
const clone = () => structuredClone(original)

test('accepts the exact immutable execution authorization', () => {
  assert.equal(validateAuthorization(clone()), true)
  for (const lessonId of Object.keys(REQUESTS)) {
    assert.equal(validateAuthorizationBinding({ path: AUTHORIZATION_PATH, sha256: AUTHORIZATION_SHA256, request_sha256: REQUESTS[lessonId] }, lessonId), true)
  }
})

for (const [name, mutate, pattern] of [
  ['stale source', (r) => { r.source_commit = 'stale' }, /source drift/],
  ['wrong batch', (r) => { r.batch_sha256 = 'wrong' }, /batch drift/],
  ['wrong identity', (r) => { r.look_id = 'wrong' }, /look drift/],
  ['wrong request', (r) => { r.request_sha256_by_lesson.L15 = 'wrong' }, /request drift/],
  ['broader scope', (r) => { r.authorization_scope = 'production' }, /scope drift/],
  ['cash authorization', (r) => { r.execution_limits.cash_purchase_authorized = true }, /payment scope drift/],
  ['retry authorization', (r) => { r.execution_limits.maximum_retries = 1 }, /call limit drift/],
  ['lower minimum balance', (r) => { r.execution_limits.minimum_account_balance = 0 }, /credit limit drift/]
]) {
  test(`fails closed on ${name}`, () => {
    const receipt = clone()
    mutate(receipt)
    assert.throws(() => validateAuthorization(receipt), pattern)
  })
}
