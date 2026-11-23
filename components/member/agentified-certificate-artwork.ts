import { AGENTIFIED_CERTIFICATE_COPY, renderCourseCertificateSvg } from './course-certificate-template'

export type CertificateDetails = { learner_name: string; completed_at: string; verification_token: string | null }

// A display reference derived from the immutable claim fields. It is not an auth key.
export function certificateRecordId(details: CertificateDetails) {
  const input = `agentified:${details.completed_at}:${details.learner_name.normalize('NFC')}`
  let first = 2166136261
  let second = 374761393
  for (const point of input) {
    const code = point.codePointAt(0) ?? 0
    first = Math.imul(first ^ code, 16777619)
    second = Math.imul(second ^ code, 1597334677)
  }
  return `AT-AGT-${(first >>> 0).toString(16).padStart(8, '0').toUpperCase()}${(second >>> 0).toString(16).padStart(8, '0').toUpperCase()}`
}

export function agentifiedCertificateSvg(details: CertificateDetails | null, name: string, assets?: { frame: string; logo: string; signature: string }) {
  const learner = (details?.learner_name || name.trim() || 'Your name').slice(0, 120)
  const date = details ? new Date(details.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'After you claim'
  const record = details ? certificateRecordId(details) : 'Assigned when claimed'
  const verification = details?.verification_token ? `Active · ${record}` : 'Verification link off'
  return renderCourseCertificateSvg({
    copy: AGENTIFIED_CERTIFICATE_COPY,
    learner,
    claimed: !!details,
    date,
    record,
    verification,
    assets,
  })
}
