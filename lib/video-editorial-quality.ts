import { validateSocialContentFinalCopyQuality } from './social-content-lifecycle'

/** Deterministic rejection is a screening step, never a narrative-quality approval. */
export const VIDEO_EDITORIAL_CRITERIA = {
  narrative_coherence: 'The spoken story connects a concrete problem, explanation, and next step.',
  spoken_language: 'The script reads naturally aloud, without field lists or requirements.',
  audience_value: 'The viewer gets a useful insight or action suited to this audience.',
  vambah_voice: 'The voice is grounded, practical, human, and connects the problem to action.',
  self_reference: 'The speaker uses first person appropriately; no third-person Vambah references.',
  internal_notes: 'The spoken words contain no production directions or internal notes.',
  supported_claims: 'Every factual or outcome claim is supported by the campaign sources.',
  campaign_alignment: 'The message and invitation match the approved campaign packet.',
} as const

export function screenVideoEditorial(script: string) {
  const safety = validateSocialContentFinalCopyQuality({ voiceover_text: script })
  const quality: string[] = []
  const lines = script.split(/\n+/).map(line => line.trim()).filter(Boolean)
  if (!script.trim()) quality.push('A saved spoken script is required.')
  if (lines.filter(line => /^(?:[-*•]|\d+[.)]|\[[ x]\])\s+/i.test(line)).length >= 2)
    quality.push('Rewrite the list as a connected spoken narrative.')
  if (/(?:^|\n)\s*(?:audience|objective|requirements?|deliverables?|hook|cta|proof|scene|visuals?|voiceover|narration|acceptance criteria|key message|teaching beats?)\s*:/i.test(script))
    quality.push('Remove brief fields and production labels from the spoken script.')
  if (/\b(?:must include|should include|ensure that|the script (?:must|should)|insert (?:a|the)|show the operating layer|on-screen text)\b/i.test(script))
    quality.push('Rewrite production requirements and stage directions as audience-facing speech.')
  if (script.trim() && (script.match(/[.!?](?:\s|$)/g) ?? []).length < 2)
    quality.push('The script needs a connected spoken explanation, not isolated fields or fragments.')
  return {
    safety: { status: safety.status, blockers: safety.findings.map(f => f.label) },
    production_quality: { status: quality.length ? 'blocked' : 'needs_review', blockers: quality },
    blockers: [...safety.findings.map(f => f.label), ...quality],
  }
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}
export function campaignVideoScript(item: { rag_context?: unknown; voiceover_text?: unknown }) {
  const assets = record(record(item.rag_context).production_assets)
  return String(record(assets.video_script).script_text || item.voiceover_text || '').trim()
}
/** Stable JSON works in both the browser and server; all asset changes invalidate review. */
export function editorialInputVersion(item: { rag_context?: unknown; voiceover_text?: unknown }) {
  const rag = record(item.rag_context)
  function stable(v: any): any {
    if (Array.isArray(v)) return v.map(stable)
    return v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v
  }
  return JSON.stringify(stable([campaignVideoScript(item), rag.production_assets ?? null, record(rag.campaign_review_handoff).packet_version ?? null]))
}
export function currentEditorialReceipt(item: { rag_context?: unknown; voiceover_text?: unknown }) {
  const receipt = record(record(item.rag_context).campaign_video_editorial)
  return receipt.status === 'approved' && receipt.input_version === editorialInputVersion(item)
    && receipt.reviewer && receipt.reviewed_at && receipt.avatar_id && receipt.voice_id
    && Object.keys(VIDEO_EDITORIAL_CRITERIA).every(key => record(receipt.checks)[key] === true)
    && screenVideoEditorial(campaignVideoScript(item)).blockers.length === 0 ? receipt : null
}
