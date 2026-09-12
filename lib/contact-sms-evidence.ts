import { createHash } from 'node:crypto'
import { SMS_DISCLOSURE, SMS_DISCLOSURE_VERSION, SMS_PROGRAM, SMS_SCOPE } from './contact-sms-consent'

// Server-only builder. No client timestamp, program, route, eligibility or version is persisted.
export function buildContactSmsEvidence(input: { email: string; phone: string; submittedPhone: string; inquiryId: number }) {
  return {
    evidence_key: createHash('sha256').update(JSON.stringify([
      input.email.trim().toLowerCase(), input.phone, SMS_PROGRAM, SMS_DISCLOSURE_VERSION,
    ])).digest('hex'),
    inquiry_id: input.inquiryId,
    submitted_phone: input.submittedPhone.trim(),
    normalized_phone: input.phone,
    affirmative_selection: true,
    program: SMS_PROGRAM,
    scope: SMS_SCOPE,
    disclosure_version: SMS_DISCLOSURE_VERSION,
    disclosure_text: SMS_DISCLOSURE,
    privacy_path: '/legal/privacy',
    terms_path: '/legal/terms#sms',
    source_route: '/#contact',
    capture_state: 'pending_verification',
    send_eligible: false,
  }
}
