import { createHash } from 'node:crypto'
import { SOCIAL_CONTENT_DECISION_RECEIPT_KEYS, type SocialContentDecisionReceiptKey } from '@/lib/social-content-decision-receipts'
import { DARK_CASTLE_COPY_CONTENT_ID } from '@/lib/dark-castle-copy-review-binding'

export const DARK_CASTLE_RECEIPT_CONTENT_VERSION = 'sha256:4b4126fe2388687c899530cdb9ee973e744d9e0ebfd2b6378ac6b3702000342a'
export const DARK_CASTLE_RECEIPT_UPDATED_AT = '2026-10-27T20:14:59.293829Z'
export const DARK_CASTLE_RECEIPT_MASTER_SHA256 = '2371cd46ad5bb583891d0f42a70e3d5cef1a57368757266b16e92fc31c311f36'
export const DARK_CASTLE_RECEIPT_THUMBNAIL_SHA256 = '5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0'

type ObjectValue = Record<string, unknown>
const record = (value: unknown): ObjectValue | null => value && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : null
const string = (value: unknown): string => typeof value === 'string' ? value.trim() : ''
const exactUtc = (value: unknown): string => string(value).replace(' ', 'T').replace(/\+00(?::00)?$/, 'Z')

export type ReceiptReviewRecord = {
  id: string
  updated_at: string
  platform: string
  status: string
  rag_context: unknown
  description_sha256: string | null
}

export type ReceiptReviewArtifact = {
  canonicalRecord: string
  contentVersion: string
  descriptionReceipt: string
  evidenceReceipt: { identity: string; observedSources: number; requiredSources: number }
  finalMediaReceipt: { sha256: string; scriptSha256: string; storyboardSha256: string }
  gameplayReceipt: { sha256: string; claimBoundary: string }
  musicReceipt: { sha256: string; authorization: string }
  providerReceipt: { status: string; sourceSha256: string; voiceEngine: string }
  externalGates: Record<string, boolean>
}

export type ReceiptReviewSelection = {
  receipt_id: string
  status: string
  social_content_id: string
  content_version: string
  selected_direction: string
  selected_asset_path: string
  selected_asset_sha256: string
}

export type ReceiptReviewPacket = {
  packet_id: string
  kind: SocialContentDecisionReceiptKey
  title: string
  content_id: string
  content_version: string
  content_updated_at: string
  evidence: { label: string; value: string }[]
  review_questions: string[]
  blockers: string[]
  receipt_id: null
  decision_recorded: false
  external_execution: false
}

const definitions: Record<SocialContentDecisionReceiptKey, { title: string; questions: string[] }> = {
  source: { title: 'Source lineage', questions: ['Do the linked sources support the exact spoken and description claims?', 'Does each product claim stay within observed gameplay?'] },
  voice: { title: 'Voice and delivery', questions: ['Does the native presenter performance sound like Vambah?', 'Does the spoken claim boundary remain clear?'] },
  framework: { title: 'Story framework', questions: ['Does the decision → handoff → response sequence teach the intended lesson?', 'Is the public pilot boundary preserved throughout?'] },
  privacy: { title: 'Privacy and rights', questions: ['Do the master and thumbnail avoid private or sensitive data?', 'Are presenter, gameplay, and music rights sufficient for this exact use?'] },
  visual: { title: 'Visual proof', questions: ['Does Direction C remain the exact approved asset?', 'Do the gameplay shots and captions support the spoken claims?'] },
  challenger: { title: 'Independent challenge', questions: ['Which claims, cuts, or transitions could mislead a skeptical viewer?', 'What correction or explicit hold is needed before copy review?'] },
}

export function buildDarkCastleReceiptReviewPackets(input: {
  item: ReceiptReviewRecord | null
  artifact: ReceiptReviewArtifact
  selection: ReceiptReviewSelection
  scriptSha256: string
  storyboardSha256: string
  masterSha256: string
  thumbnailSha256: string
}): ReceiptReviewPacket[] {
  const { item, artifact, selection } = input
  const rag = record(item?.rag_context)
  const description = record(rag?.youtube_description_receipt)
  const reconciliation = record(rag?.description_evidence_reconciliation_receipt)
  const existing = record(rag?.copy_review_evidence_receipts)
  const sourceLineage = rag?.source_lineage
  const sourceUrls = Array.isArray(sourceLineage) && sourceLineage.every((entry) => typeof entry === 'string' && /^https:\/\//.test(entry))
    ? sourceLineage as string[] : []
  const common: string[] = []
  if (!item || item.id !== DARK_CASTLE_COPY_CONTENT_ID || item.platform !== 'youtube' || item.status !== 'draft') common.push('Exact draft record is unavailable or changed.')
  if (string(rag?.content_version) !== DARK_CASTLE_RECEIPT_CONTENT_VERSION || artifact.contentVersion !== DARK_CASTLE_RECEIPT_CONTENT_VERSION || selection.content_version !== DARK_CASTLE_RECEIPT_CONTENT_VERSION) common.push('Content version differs from the reviewed version.')
  if (exactUtc(item?.updated_at) !== DARK_CASTLE_RECEIPT_UPDATED_AT) common.push('The persisted record changed after this packet snapshot.')
  if (artifact.canonicalRecord !== DARK_CASTLE_COPY_CONTENT_ID || selection.social_content_id !== DARK_CASTLE_COPY_CONTENT_ID) common.push('Artifact or selection belongs to another record.')
  if (string(description?.receipt_id) !== artifact.descriptionReceipt || string(description?.content_version) !== DARK_CASTLE_RECEIPT_CONTENT_VERSION || string(description?.description_sha256) !== item?.description_sha256) common.push('Saved description and its receipt are not exactly bound.')
  if (string(reconciliation?.receipt_id) !== artifact.evidenceReceipt.identity || string(reconciliation?.content_version) !== DARK_CASTLE_RECEIPT_CONTENT_VERSION || string(reconciliation?.status) !== 'passed' || string(reconciliation?.evidence_input_fingerprint) !== string(description?.evidence_input_fingerprint)) common.push('Description evidence reconciliation is missing or mismatched.')
  if (input.masterSha256 !== DARK_CASTLE_RECEIPT_MASTER_SHA256 || artifact.finalMediaReceipt.sha256 !== input.masterSha256 || input.thumbnailSha256 !== DARK_CASTLE_RECEIPT_THUMBNAIL_SHA256 || selection.selected_asset_sha256 !== input.thumbnailSha256 || selection.selected_direction !== 'C' || selection.status !== 'human_qa_approved' || !selection.receipt_id) common.push('Approved master or Direction C binding is missing or mismatched.')
  if (input.scriptSha256 !== artifact.finalMediaReceipt.scriptSha256 || input.storyboardSha256 !== artifact.finalMediaReceipt.storyboardSha256) common.push('Script or storyboard hash differs from the final master receipt.')
  if (Object.values(artifact.externalGates).some(Boolean)) common.push('An external execution gate is open in the master receipt.')
  if (new Set(sourceUrls).size !== sourceUrls.length) common.push('Source lineage contains a duplicate URL.')
  const ids = new Set<string>()
  for (const key of SOCIAL_CONTENT_DECISION_RECEIPT_KEYS) {
    const receipt = record(existing?.[key])
    const id = string(receipt?.receipt_id)
    if (!id) continue
    if (ids.has(id)) common.push('Existing prerequisite receipt identities are duplicated.')
    ids.add(id)
  }
  const evidenceByKind: Record<SocialContentDecisionReceiptKey, { label: string; value: string }[]> = {
    source: [
      { label: 'Description reconciliation', value: artifact.evidenceReceipt.identity },
      { label: 'Owned gameplay SHA-256', value: artifact.gameplayReceipt.sha256 },
      ...sourceUrls.map((url, index) => ({ label: `Source ${index + 1}`, value: url })),
    ],
    voice: [
      { label: 'Spoken script SHA-256', value: input.scriptSha256 },
      { label: 'Presenter source SHA-256', value: artifact.providerReceipt.sourceSha256 },
      { label: 'Voice engine', value: artifact.providerReceipt.voiceEngine },
    ],
    framework: [
      { label: 'Spoken script SHA-256', value: input.scriptSha256 },
      { label: 'Storyboard SHA-256', value: input.storyboardSha256 },
      { label: 'Master SHA-256', value: input.masterSha256 },
    ],
    privacy: [
      { label: 'Gameplay claim boundary', value: artifact.gameplayReceipt.claimBoundary },
      { label: 'Music use authorization', value: artifact.musicReceipt.authorization },
      { label: 'Description receipt', value: artifact.descriptionReceipt },
    ],
    visual: [
      { label: 'Direction C selection', value: selection.receipt_id },
      { label: 'Thumbnail SHA-256', value: input.thumbnailSha256 },
      { label: 'Master SHA-256', value: input.masterSha256 },
    ],
    challenger: [
      { label: 'Spoken script SHA-256', value: input.scriptSha256 },
      { label: 'Storyboard SHA-256', value: input.storyboardSha256 },
      { label: 'Description reconciliation', value: artifact.evidenceReceipt.identity },
    ],
  }
  return SOCIAL_CONTENT_DECISION_RECEIPT_KEYS.map((kind) => {
    const blockers = [...common]
    if (kind === 'source' && sourceUrls.length !== artifact.evidenceReceipt.observedSources) blockers.push('Source lineage count does not match the reconciled evidence.')
    if (kind === 'voice' && artifact.providerReceipt.status !== 'complete') blockers.push('Presenter source is incomplete.')
    if (kind === 'privacy' && !artifact.musicReceipt.sha256) blockers.push('Music rights evidence is incomplete.')
    if (kind === 'visual' && !selection.selected_asset_path.endsWith('/03-accidental-success-v2.png')) blockers.push('Direction C path is mismatched.')
    const receipt = record(existing?.[kind])
    if (receipt) blockers.push(`${kind} prerequisite receipt already exists; inspect the persisted receipt rather than preparing a duplicate.`)
    else blockers.push(`${kind} reviewer decision and persisted prerequisite receipt are missing.`)
    const fingerprint = createHash('sha256').update(JSON.stringify({ kind, contentId: DARK_CASTLE_COPY_CONTENT_ID, contentVersion: DARK_CASTLE_RECEIPT_CONTENT_VERSION, contentUpdatedAt: DARK_CASTLE_RECEIPT_UPDATED_AT, evidence: evidenceByKind[kind] })).digest('hex').slice(0, 20)
    return {
      packet_id: `dark-castle-review-packet:${kind}:${fingerprint}`,
      kind, title: definitions[kind].title,
      content_id: DARK_CASTLE_COPY_CONTENT_ID,
      content_version: DARK_CASTLE_RECEIPT_CONTENT_VERSION,
      content_updated_at: DARK_CASTLE_RECEIPT_UPDATED_AT,
      evidence: evidenceByKind[kind],
      review_questions: definitions[kind].questions,
      blockers,
      receipt_id: null, decision_recorded: false, external_execution: false,
    }
  })
}
