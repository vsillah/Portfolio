import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const AUTHORIZATION_FILE = 'execution-authorization-receipt.json'
export const AUTHORIZATION_PATH = `agentified/workshop/l13-l16-native-composite/${AUTHORIZATION_FILE}`
export const AUTHORIZATION_SHA256 = '0a4342bf657955f0ea8540afe862a26c73d57195986e730067ac8ccdca87032c'
export const REQUESTS = Object.freeze({
  L13: 'ca8117572b7e862a9dcdd15b1b901886cfe1068dbc2be487c6cde6f17cb84876',
  L14: '93414761a5a5a49ebc6068bf72ef5f0055418030f27ec57abe0fafe4f9781e6b',
  L15: '9683b252bff8ec732942905713cc98f06f6d8643814c547d8ad1cc580c8dd224',
  L16: '2a9fc51f0bdaa64401b57a10d3beac2989d51286187fc5fd11525ed2bb16b314'
})

const sha = (value) => createHash('sha256').update(value).digest('hex')
const assert = (condition, message) => { if (!condition) throw new Error(message) }

export function validateAuthorization(receipt) {
  assert(receipt?.status === 'approved_and_executed_within_scope', 'authorization status drift')
  assert(receipt.authorization_scope === 'agentified_l13_l16_review_only_sources', 'authorization scope drift')
  assert(receipt.source_commit === '5d61cadff39b46d5d17add8e06370cc25a18de41', 'authorization source drift')
  assert(receipt.batch_sha256 === '18b3a6bfa3ee1dc6fadedb2cc969a312e8a9acf935bfb50684ad0d812b0cb194', 'authorization batch drift')
  assert(receipt.look_id === '7275ba9035f94b31ad589dda6532d002', 'authorization look drift')
  assert(receipt.voice_id === '4f53988b1c314610b514db98432fd0ef', 'authorization voice drift')
  assert(JSON.stringify(receipt.request_sha256_by_lesson) === JSON.stringify(REQUESTS), 'authorization request drift')
  const limits = receipt.execution_limits
  assert(limits.existing_subscription_credits_only && !limits.cash_purchase_authorized && !limits.auto_reload_reliance_authorized, 'authorization payment scope drift')
  assert(limits.maximum_calls === 8 && limits.maximum_calls_per_lesson === 2 && limits.maximum_retries === 0, 'authorization call limit drift')
  assert(limits.maximum_credits_per_lesson === 150 && limits.maximum_aggregate_credits === 600 && limits.minimum_account_balance === 168, 'authorization credit limit drift')
  assert(receipt.authorization_provenance?.source_message_id === 'msg_03aad1e9d96279fd016af197e6fe0c87d2a3612dba9a15f69e', 'authorization provenance drift')
  assert(receipt.immutability?.version_bound && receipt.immutability?.scope_expansion_requires_new_approval, 'authorization immutability drift')
  return true
}

export function loadAuthorization(directory) {
  const raw = readFileSync(path.join(directory, AUTHORIZATION_FILE))
  assert(sha(raw) === AUTHORIZATION_SHA256, 'authorization receipt hash drift')
  const receipt = JSON.parse(raw)
  validateAuthorization(receipt)
  return receipt
}

export function validateAuthorizationBinding(binding, lessonId) {
  assert(binding?.path === AUTHORIZATION_PATH, `${lessonId} authorization path drift`)
  assert(binding?.sha256 === AUTHORIZATION_SHA256, `${lessonId} authorization hash drift`)
  assert(binding?.request_sha256 === REQUESTS[lessonId], `${lessonId} authorization request binding drift`)
  return true
}
