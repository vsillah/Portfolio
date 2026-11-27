import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const SHA = /^[a-f0-9]{64}$/
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const instant = (value) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value))
const lockedActions = ['policy_activation_enabled', 'evidence_linkage_enabled', 'scoring_enabled', 'persistence_enabled', 'live_collection_enabled', 'media_generation_enabled', 'notification_enabled', 'upload_enabled', 'schedule_enabled', 'publish_enabled', 'external_actions_enabled', 'production_mutation_enabled']

/** A pure, review-only validation. It can never issue an approved source-class policy. */
export function validateCandidate(candidate, sourcePacket, sourceBytes, now = new Date()) {
  const blockers = []
  const add = (condition, message) => { if (!condition) blockers.push(message) }
  add(candidate?.version === 'youtube-external-metadata-policy-receipt-candidate/v1' && candidate?.status === 'review_only_blocked' && candidate?.approved === false, 'Candidate must remain unapproved and review-only.')
  add(candidate?.source_class === 'external_creator' && candidate?.platform === 'youtube' && candidate?.format === 'shorts_candidate', 'Source class boundary changed.')
  add(candidate?.source_packet_file_sha256 === sha(sourceBytes), 'Source packet bytes changed or hash is invalid.')
  add(SHA.test(candidate?.acquisition_receipt_sha256 ?? '') && candidate?.acquisition_receipt_sha256 === sourcePacket?.acquisition_receipt_sha256, 'Acquisition receipt version differs.')
  add(candidate?.content_id === sourcePacket?.content_id && candidate?.calendar_item_id === sourcePacket?.calendar_item_id, 'Content or calendar binding differs.')
  add(candidate?.source_cohort_sha256_reported === sourcePacket?.source_cohort_sha256, 'Original cohort binding differs.')
  add(candidate?.authority_receipt_id === null && candidate?.authority_id === null && candidate?.authority_version === null && candidate?.policy_sha256 === null, 'Unverified authority was inserted.')
  add(candidate?.retention_rule?.maximum_calendar_days_without_delete_or_refresh === 30 && candidate?.retention_rule?.expires_at === null && candidate?.retention_rule?.expiry_basis === null, 'A retention ceiling was promoted to an issued expiry.')
  add(candidate?.observation_window?.start === null && candidate?.observation_window?.end === null && candidate?.observation_window?.grade === 'unverified', 'An unverified observation window was promoted.')
  add(candidate?.privacy_receipt?.approved === false && candidate?.privacy_receipt?.authority_receipt_id === null && candidate?.rights_receipt?.approved === false && candidate?.rights_receipt?.authority_receipt_id === null, 'Privacy or rights authority was inferred.')
  add(candidate?.dimensions?.privacy === 'unresolved' && candidate?.dimensions?.rights === 'unresolved' && candidate?.dimensions?.derived_scoring === 'prohibited_without_accepted_amendment', 'Independent policy dimensions were weakened.')
  add(candidate?.cohort?.performance_weight === 0 && candidate?.cohort?.outlier_score === null && candidate?.cohort?.included_video_ids?.length === 0, 'Blocked cohort gained performance weight or a score.')
  add(candidate?.human_qa === 'pending', 'Human QA was advanced.')
  add(candidate?.rollback?.production_records_unchanged === true && candidate?.rollback?.historical_source_preserved === true, 'Rollback or unchanged-production claim was removed.')
  for (const key of lockedActions) add(candidate?.locks?.[key] === false, `External-action lock ${key} is not false.`)
  const sourceRows = sourcePacket?.candidate_bindings ?? []
  add(Array.isArray(candidate?.rows) && candidate.rows.length === sourceRows.length, 'Comparable row count differs.')
  if (Array.isArray(candidate?.rows)) for (const [index, row] of candidate.rows.entries()) {
    const source = sourceRows[index]
    add(Boolean(source) && row?.video_id === source.video_id && row?.canonical_url === `https://www.youtube.com/shorts/${source.video_id}` && row?.response_body_sha256_reported === source.response_body_sha256, `Row ${index} source identity or reported hash differs.`)
    add(row?.raw_response_sha256_verified === null && row?.parsed_response_sha256_verified === null, `Row ${index} falsely claims verified raw provenance.`)
    add(row?.cohort_decision === 'excluded_pending_exact_verification' && row?.public_status === null && row?.observed_at === null, `Row ${index} was included without exact verification.`)
    add(row?.views === null && row?.likes === null && row?.comments === null && row?.public_subscribers === null, `Row ${index} contains unsupported live metrics.`)
  }
  if (candidate?.retention_rule?.expires_at != null) add(instant(candidate.retention_rule.expires_at) && Date.parse(candidate.retention_rule.expires_at) > now.getTime(), 'Issued expiry is missing, expired, or malformed.')
  return { status: 'blocked', blockers }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const candidatePath = resolve(process.argv[2] ?? 'artifacts/research/jev-youtube-shorts-thumbnail-cohort-2026-10-18/source-class-policy-receipt-candidate-v1.json')
  const candidate = JSON.parse(readFileSync(candidatePath, 'utf8'))
  const sourcePath = resolve(candidate.source_packet_path)
  const sourceBytes = readFileSync(sourcePath)
  const result = validateCandidate(candidate, JSON.parse(sourceBytes.toString('utf8')), sourceBytes)
  process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  if (result.blockers.length) process.exitCode = 1
}
