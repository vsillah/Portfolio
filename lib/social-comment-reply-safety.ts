/** Pure reply review/claim contract shared by HTTP, Slack and inbox projection. */
type Row = Record<string, unknown>
function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {}
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
export function socialCommentReplyText(row: Row): string {
  return text(row.approved_reply_text) || text(row.proposed_reply_text)
}
export function socialCommentReplyRelease(row: Row): Row { return record(record(row.metadata).reply_release) }
export function isSocialCommentReplyLocked(row: Row): boolean {
  const legacy = record(record(row.metadata).youtube_reply_readiness)
  return Boolean(row.reply_provider_comment_id || row.reply_submitted_at)
    || ['submitted', 'failed'].includes(String(row.reply_submission_state))
    || ['submitting', 'uncertain', 'submitted'].includes(String(socialCommentReplyRelease(row).status))
    || legacy.status === 'claiming' || legacy.external_submission_attempted === true
}
export function matchesSocialCommentReplyReview(row: Row, version: unknown, reply: unknown): boolean {
  return typeof version === 'string' && Boolean(version) && version === row.updated_at
    && typeof reply === 'string' && reply === socialCommentReplyText(row)
}
