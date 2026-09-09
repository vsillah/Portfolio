import { createHash } from 'crypto'

/** Exact queue copy identity. No whitespace trimming of subject/body. */
export function warmFinalCopyFingerprint(input: {
  id: string
  contact_submission_id: number
  subject: string | null
  body: string | null
  contact_submissions: { email?: string | null } | null
}) {
  return `warm-final-copy:v1:${createHash('sha256').update(JSON.stringify([
    input.id, input.contact_submission_id,
    input.contact_submissions?.email?.trim().toLowerCase() ?? '',
    input.subject ?? '', input.body ?? '',
  ])).digest('hex')}`
}
