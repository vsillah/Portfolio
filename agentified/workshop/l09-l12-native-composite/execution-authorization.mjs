import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const AUTHORIZATION_FILE = 'execution-authorization-receipt.json'
export const AUTHORIZATION_PATH = `agentified/workshop/l09-l12-native-composite/${AUTHORIZATION_FILE}`
export const AUTHORIZATION_SHA256 = 'a3401459019b02c36e08d9a84b5880acdf781fddc29c0c61a9d187870edc910d'

export const EXPECTED_AUTHORIZATION = Object.freeze({
  sourceCommit: 'cb44c2389b4281aac7dae33d835363ae35c42ea2',
  batchSha256: 'c339600cab53a406b01ae80399354bf718e94a36863322f934d795c424aa6ed5',
  lookId: '7275ba9035f94b31ad589dda6532d002',
  voiceId: '4f53988b1c314610b514db98432fd0ef',
  requests: Object.freeze({
    L09: 'cb89bf17ea0df2de96018439b3b54ce13aa5b4fbe017724b7c9ab5047c556fcd',
    L10: '19a70e94acb9c75e633535211ce54af1b4e1075f2ec5da7d40048c90593694a8',
    L11: '7a139886e0f6b35daf35bab1b44ab4eb582127cd4aadedbcf59f810011cc74b8',
    L12: '56498ca2f4748dc058a63ca80efe27e340d3474d0025c4f335e93e1e9d8a15b7'
  })
})

const REQUIRED_EXCLUSIONS = Object.freeze([
  'generate_l13_l16',
  'alter_narration_or_assets',
  'activate_learner_playback',
  'purchase_credits',
  'rely_on_auto_reload',
  'upload_unrelated_material',
  'publish',
  'distribute',
  'apply_migrations',
  'mutate_production_data',
  'change_credentials_or_account_settings',
  'send_externally'
])

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

export const sha256 = (content) => createHash('sha256').update(content).digest('hex')

export function validateAuthorizationReceipt(receipt) {
  assert(receipt?.schema_version === 1, 'authorization receipt schema drift')
  assert(receipt.status === 'approved_and_executed_within_scope', 'authorization status drift')
  assert(receipt.authorization_scope === 'agentified_l09_l12_review_only_sources', 'authorization scope drift')
  assert(receipt.source_commit === EXPECTED_AUTHORIZATION.sourceCommit, 'authorization source commit drift')
  assert(receipt.batch_sha256 === EXPECTED_AUTHORIZATION.batchSha256, 'authorization batch hash drift')
  assert(receipt.look_id === EXPECTED_AUTHORIZATION.lookId, 'authorization look identity drift')
  assert(receipt.voice_id === EXPECTED_AUTHORIZATION.voiceId, 'authorization voice identity drift')
  assert(JSON.stringify(receipt.request_sha256_by_lesson) === JSON.stringify(EXPECTED_AUTHORIZATION.requests), 'authorization request binding drift')
  assert(receipt.identity_and_voice_use?.approved === true, 'identity and voice use not approved')
  assert(receipt.identity_and_voice_use?.purpose === 'Agentified L09-L12 review-only sources', 'identity and voice purpose drift')
  assert(receipt.identity_and_voice_use?.look_id === EXPECTED_AUTHORIZATION.lookId, 'identity receipt look drift')
  assert(receipt.identity_and_voice_use?.voice_id === EXPECTED_AUTHORIZATION.voiceId, 'identity receipt voice drift')
  assert(receipt.execution_limits?.existing_subscription_credits_only === true, 'existing-credit-only constraint drift')
  assert(receipt.execution_limits?.cash_purchase_authorized === false, 'cash purchase authorization broadened')
  assert(receipt.execution_limits?.auto_reload_reliance_authorized === false, 'auto-reload authorization broadened')
  assert(receipt.execution_limits?.maximum_jobs === 4, 'job limit drift')
  assert(receipt.execution_limits?.maximum_retries === 0, 'retry limit drift')
  assert(JSON.stringify(receipt.execution_limits?.submission_order) === JSON.stringify(['L09', 'L10', 'L11', 'L12']), 'submission order drift')
  assert(receipt.provider_configuration?.l09_parameter_amendment === 'omit_unsupported_expressiveness_parameter_only', 'L09 amendment drift')
  assert(receipt.provider_configuration?.all_other_bindings_unchanged === true, 'provider binding scope broadened')
  assert(REQUIRED_EXCLUSIONS.every((value) => receipt.exclusions?.includes(value)), 'authorization exclusion missing')
  assert(receipt.exclusions?.length === REQUIRED_EXCLUSIONS.length, 'authorization exclusions broadened or altered')
  assert(receipt.immutability?.version_bound === true, 'authorization is not version-bound')
  assert(receipt.immutability?.authorization_may_not_be_inferred_from_provider_receipts === true, 'authorization inference boundary drift')
  assert(receipt.immutability?.scope_expansion_requires_new_approval === true, 'scope expansion boundary drift')
  assert(receipt.authorization_provenance?.[0]?.source_message_id === 'msg_03aad1e9d96279fd016af1018e20e087d2824d806243304a3c', 'batch authorization provenance drift')
  assert(receipt.authorization_provenance?.[1]?.source_message_id === 'msg_03aad1e9d96279fd016af102f3dc8487d28b92e90fe48534d0', 'L09 amendment provenance drift')
  return true
}

export function loadAndValidateAuthorizationReceipt(directory) {
  const authorizationFile = path.join(directory, AUTHORIZATION_FILE)
  const raw = readFileSync(authorizationFile)
  assert(sha256(raw) === AUTHORIZATION_SHA256, 'authorization receipt hash drift')
  const receipt = JSON.parse(raw.toString('utf8'))
  validateAuthorizationReceipt(receipt)
  return receipt
}

export function validateAuthorizationBinding(binding, lessonId) {
  assert(binding?.path === AUTHORIZATION_PATH, `${lessonId} authorization receipt path drift`)
  assert(binding?.sha256 === AUTHORIZATION_SHA256, `${lessonId} authorization receipt hash binding drift`)
  assert(binding?.request_sha256 === EXPECTED_AUTHORIZATION.requests[lessonId], `${lessonId} authorization request binding drift`)
  return true
}
