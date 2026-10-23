import type { SocialContentItem } from '@/lib/social-content'

export const DARK_CASTLE_VISUAL_QA_ID = 'dark-castle-youtube-visual-contract-qa'
export const DARK_CASTLE_SOCIAL_CONTENT_ID = '21c492c2-9279-4e08-afc9-49207935a681'
export const DARK_CASTLE_VISUAL_PATH = '/api/admin/social-content/qa-visual/dark-castle-youtube'
export const DARK_CASTLE_VISUAL_SHA256 = '32270fcb035a9159679ab23584788e45571eef47f685083ea77eeb38620ebf62'
export const DARK_CASTLE_WALKTHROUGH_SHA256 = '50f9985a0dc052dbb05d4f2d0808ba2a3e5837080782d1b9dcb9e0b995444e5f'
export const DARK_CASTLE_COPY_APPROVED_AT = '2026-10-23T23:07:32.922112+00:00'
export const DARK_CASTLE_EVIDENCE_FINGERPRINT = 'fnv1a:07f944bb'

export function approvedVisualStorageUrl(copyVersion: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''): string | null {
  if (!/^[a-f0-9]{64}$/.test(copyVersion)) return null
  try {
    const base = new URL(supabaseUrl)
    if (base.protocol !== 'https:') return null
    return `${base.origin}/storage/v1/object/public/social-content/approved-review/${DARK_CASTLE_SOCIAL_CONTENT_ID}/${copyVersion}/${DARK_CASTLE_VISUAL_SHA256}.png`
  } catch {
    return null
  }
}

export type ApprovedVisualReviewContract = {
  version: 'approved_visual_review_v1'
  social_content_id: string
  work_item_id: string
  calendar_item_id: string
  copy_version: string
  copy_approved_at: string
  evidence_fingerprint: string
  asset_path: string
  asset_sha256: string
  walkthrough_sha256: string
  sources: Array<{ url: string; sha256: string }>
  provider: 'none'
  external_actions: { upload: false; platform_draft: false; schedule: false; publish: false; external_send: false }
}

const SOURCE_HASHES = [
  ['https://dark-castle-chess.vercel.app/welcome/media/explore-computer.jpg', '27d79426c04fa984569dc337623d1eb4a514392bf2e067563d9982d43d77dcdf'],
  ['https://dark-castle-chess.vercel.app/welcome/media/explore-position.jpg', '896dce9162e815c1138dfbecacd24e0a63d05e99901f98b89022ddeee225f9df'],
  ['https://dark-castle-chess.vercel.app/welcome/media/explore-start.jpg', 'c794cc0b96ecde2be8b99fa930b45ac2a2e055d7ec92dc45654ac592082af3ae'],
] as const

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export function approvedVisualReviewContract(copyVersion: string, assetPath = DARK_CASTLE_VISUAL_PATH): ApprovedVisualReviewContract {
  return {
    version: 'approved_visual_review_v1',
    social_content_id: DARK_CASTLE_SOCIAL_CONTENT_ID,
    work_item_id: '2403b70a-c262-429e-8da3-964e082f5a59',
    calendar_item_id: '4070755c-7c46-4c3e-ac9b-94d35921556e',
    copy_version: copyVersion,
    copy_approved_at: DARK_CASTLE_COPY_APPROVED_AT,
    evidence_fingerprint: DARK_CASTLE_EVIDENCE_FINGERPRINT,
    asset_path: assetPath,
    asset_sha256: DARK_CASTLE_VISUAL_SHA256,
    walkthrough_sha256: DARK_CASTLE_WALKTHROUGH_SHA256,
    sources: SOURCE_HASHES.map(([url, sha256]) => ({ url, sha256 })),
    provider: 'none',
    external_actions: { upload: false, platform_draft: false, schedule: false, publish: false, external_send: false },
  }
}

export function inspectApprovedVisualReviewContract(item: Pick<SocialContentItem, 'id' | 'image_url' | 'rag_context'>, copyVersion: string) {
  const rag = record(item.rag_context)
  const raw = record(rag.deterministic_visual_review_contract)
  if (!Object.keys(raw).length) return { state: 'missing' as const, contract: null, reason: 'No approved visual review contract is bound to this copy version.' }
  const contract = raw as ApprovedVisualReviewContract
  const approval = record(rag.deterministic_visual_review_approval)
  const expectedAssetPath = item.id === DARK_CASTLE_VISUAL_QA_ID ? DARK_CASTLE_VISUAL_PATH : approvedVisualStorageUrl(copyVersion)
  const expected = approvedVisualReviewContract(copyVersion, expectedAssetPath || '')
  const checks = [
    Boolean(expectedAssetPath),
    contract.version === expected.version,
    contract.social_content_id === DARK_CASTLE_SOCIAL_CONTENT_ID,
    item.id === DARK_CASTLE_SOCIAL_CONTENT_ID || item.id === DARK_CASTLE_VISUAL_QA_ID,
    contract.work_item_id === expected.work_item_id,
    contract.calendar_item_id === expected.calendar_item_id,
    contract.copy_version === copyVersion,
    contract.copy_approved_at === expected.copy_approved_at,
    contract.evidence_fingerprint === expected.evidence_fingerprint,
    approval.copy_approved_at === expected.copy_approved_at,
    approval.evidence_fingerprint === expected.evidence_fingerprint,
    contract.asset_path === expected.asset_path,
    contract.asset_sha256 === expected.asset_sha256,
    contract.walkthrough_sha256 === expected.walkthrough_sha256,
    JSON.stringify(contract.sources) === JSON.stringify(expected.sources),
    contract.provider === 'none',
    JSON.stringify(contract.external_actions) === JSON.stringify(expected.external_actions),
    item.image_url === expected.asset_path,
  ]
  return checks.every(Boolean)
    ? { state: 'current' as const, contract, reason: 'Approved provider-free gameplay composition matches this copy and evidence.' }
    : { state: 'blocked' as const, contract, reason: 'The visual review contract is stale, incomplete, or differs from the approved copy, evidence, source captures, or asset hash.' }
}
