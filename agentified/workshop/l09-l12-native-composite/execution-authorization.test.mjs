import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  AUTHORIZATION_PATH,
  AUTHORIZATION_SHA256,
  EXPECTED_AUTHORIZATION,
  loadAndValidateAuthorizationReceipt,
  validateAuthorizationBinding,
  validateAuthorizationReceipt
} from './execution-authorization.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const original = JSON.parse(readFileSync(path.join(here, 'execution-authorization-receipt.json'), 'utf8'))
const clone = () => structuredClone(original)

test('accepts the exact immutable execution authorization', () => {
  assert.equal(validateAuthorizationReceipt(clone()), true)
  for (const lessonId of Object.keys(EXPECTED_AUTHORIZATION.requests)) {
    assert.equal(validateAuthorizationBinding({ path: AUTHORIZATION_PATH, sha256: AUTHORIZATION_SHA256, request_sha256: EXPECTED_AUTHORIZATION.requests[lessonId] }, lessonId), true)
  }
})

for (const [name, mutate, pattern] of [
  ['stale source commit', (receipt) => { receipt.source_commit = 'stale' }, /source commit drift/],
  ['wrong batch hash', (receipt) => { receipt.batch_sha256 = 'wrong' }, /batch hash drift/],
  ['wrong look identity', (receipt) => { receipt.look_id = 'wrong' }, /look identity drift/],
  ['wrong voice identity', (receipt) => { receipt.voice_id = 'wrong' }, /voice identity drift/],
  ['wrong request hash', (receipt) => { receipt.request_sha256_by_lesson.L11 = 'wrong' }, /request binding drift/],
  ['broader scope', (receipt) => { receipt.authorization_scope = 'production_and_review' }, /scope drift/],
  ['cash authorization', (receipt) => { receipt.execution_limits.cash_purchase_authorized = true }, /cash purchase authorization broadened/],
  ['retry authorization', (receipt) => { receipt.execution_limits.maximum_retries = 1 }, /retry limit drift/],
  ['missing exclusion', (receipt) => { receipt.exclusions.pop() }, /authorization exclusion missing/]
]) {
  test(`fails closed on ${name}`, () => {
    const receipt = clone()
    mutate(receipt)
    assert.throws(() => validateAuthorizationReceipt(receipt), pattern)
  })
}

test('fails closed on an altered receipt binding', () => {
  assert.throws(
    () => validateAuthorizationBinding({ path: AUTHORIZATION_PATH, sha256: 'altered', request_sha256: EXPECTED_AUTHORIZATION.requests.L09 }, 'L09'),
    /hash binding drift/
  )
})

test('fails closed when the immutable receipt is absent', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'agentified-auth-absent-'))
  try {
    assert.throws(() => loadAndValidateAuthorizationReceipt(directory), /ENOENT/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('fails closed when the immutable receipt bytes are altered', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'agentified-auth-altered-'))
  try {
    writeFileSync(path.join(directory, 'execution-authorization-receipt.json'), `${JSON.stringify(original, null, 2)} \n`)
    assert.throws(() => loadAndValidateAuthorizationReceipt(directory), /hash drift/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
