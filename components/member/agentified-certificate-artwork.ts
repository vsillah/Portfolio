export type CertificateDetails = { learner_name: string; completed_at: string; verification_token: string | null }

const xml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character)

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

function nameLines(value: string) {
  const words = value.trim().split(/\s+/).flatMap((word) => word.match(/.{1,34}/gu) ?? [])
  const lines: string[] = []
  for (const word of words) {
    const last = lines.length - 1
    if (last >= 0 && `${lines[last]} ${word}`.length <= 34) lines[last] += ` ${word}`
    else lines.push(word)
  }
  return lines.slice(0, 4)
}

export function agentifiedCertificateSvg(details: CertificateDetails | null, name: string, assets?: { logo: string; signature: string }) {
  const claimed = !!details
  const learner = (details?.learner_name || name.trim() || 'Your name').slice(0, 120)
  const lines = nameLines(learner)
  const nameSize = lines.length > 2 ? 50 : lines.some((line) => line.length > 26) ? 62 : 77
  const startY = lines.length > 2 ? 550 : lines.length === 2 ? 555 : 575
  const date = details ? new Date(details.completed_at).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' }) : 'After you claim'
  const record = details ? certificateRecordId(details) : 'Assigned when claimed'
  const verification = details?.verification_token ? `Active · ${record}` : 'Verification link off'
  const logo = xml(assets?.logo || '/amadutown-logo-upscaled.png')
  const signature = xml(assets?.signature || '/accelerated/vambah-signature.png')
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1600 1100" width="1600" height="1100" role="img" aria-labelledby="agentified-certificate-title agentified-certificate-description">
    <title id="agentified-certificate-title">Agentified workshop completion certificate</title>
    <desc id="agentified-certificate-description">${xml(learner)}${claimed ? ` completed Agentified on ${xml(date)}` : ' may claim this certificate after completing the workshop'}.</desc>
    <rect width="1600" height="1100" fill="#f5f0e3"/><path d="M0 0h1600v86H0zM0 1014h1600v86H0z" fill="#102e39"/>
    <path d="M0 0h166v1100H0z" fill="#123b45"/><path d="M52 113v874M90 113v874" stroke="#4a8c84" stroke-width="2" opacity=".58"/>
    <path d="M166 0h14v1100h-14z" fill="#c29540"/><path d="M211 120h1267v880H211z" fill="none" stroke="#b48b43" stroke-width="2"/>
    <path d="M238 146h1214v850H238z" fill="none" stroke="#b8aa8a" stroke-width="1"/>
    <image href="${logo}" x="765" y="124" width="75" height="94" preserveAspectRatio="xMidYMid meet"/>
    <text x="802" y="260" fill="#173a45" font-family="Arial,sans-serif" font-size="19" font-weight="700" text-anchor="middle" letter-spacing="7">AMADUTOWN</text>
    <text x="802" y="328" fill="#3c776f" font-family="Arial,sans-serif" font-size="19" font-weight="700" text-anchor="middle" letter-spacing="6">AGENTIFIED WORKSHOP</text>
    <text x="802" y="415" fill="#102e39" font-family="Georgia,serif" font-size="64" text-anchor="middle">Certificate of Completion</text>
    <path d="M548 444h508" stroke="#b48b43" stroke-width="2"/><path d="M802 434l10 10-10 10-10-10z" fill="#b48b43"/>
    <text x="802" y="482" fill="#42575b" font-family="Georgia,serif" font-size="26" text-anchor="middle">Awarded to</text>
    ${lines.map((line, index) => `<text x="802" y="${startY + index * (nameSize + 6)}" fill="#102e39" font-family="Georgia,serif" font-size="${nameSize}" font-weight="700" text-anchor="middle" textLength="${Math.min(1070, line.length * nameSize * .58)}" lengthAdjust="spacingAndGlyphs">${xml(line)}</text>`).join('')}
    <text x="802" y="758" fill="#334d54" font-family="Georgia,serif" font-size="27" text-anchor="middle">for completing all sixteen lessons in</text>
    <text x="802" y="817" fill="#123b45" font-family="Georgia,serif" font-size="49" font-weight="700" text-anchor="middle" letter-spacing="5">AGENTIFIED</text>
    <text x="802" y="851" fill="#4c6a6a" font-family="Arial,sans-serif" font-size="18" text-anchor="middle" letter-spacing="2">BUILD A GOVERNED AGENT OPERATING SYSTEM</text>
    <text x="272" y="912" fill="#86682e" font-family="Arial,sans-serif" font-size="15" font-weight="700" letter-spacing="2">COMPLETED</text>
    <text x="272" y="938" fill="#102e39" font-family="Georgia,serif" font-size="22">${xml(date)}</text>
    <image href="${signature}" x="650" y="863" width="300" height="75" preserveAspectRatio="xMidYMid meet"/>
    <path d="M653 941h294" stroke="#102e39" stroke-width="1.5"/>
    <text x="800" y="966" fill="#102e39" font-family="Georgia,serif" font-size="22" font-weight="700" text-anchor="middle">Vambah Sillah</text>
    <text x="800" y="990" fill="#4c6264" font-family="Arial,sans-serif" font-size="15" text-anchor="middle">Founder, AmaduTown</text>
    <text x="1388" y="901" fill="#86682e" font-family="Arial,sans-serif" font-size="14" font-weight="700" text-anchor="end" letter-spacing="2">CERTIFICATE RECORD ID</text>
    <text x="1388" y="927" fill="#102e39" font-family="Arial,sans-serif" font-size="19" text-anchor="end">${xml(record)}</text>
    <text x="1388" y="956" fill="#86682e" font-family="Arial,sans-serif" font-size="14" font-weight="700" text-anchor="end" letter-spacing="2">VERIFICATION REFERENCE</text>
    <text x="1388" y="982" fill="#102e39" font-family="Arial,sans-serif" font-size="18" text-anchor="end">${xml(verification)}</text>
    <text x="804" y="1055" fill="#f4e8ca" font-family="Arial,sans-serif" font-size="16" text-anchor="middle" letter-spacing="1">WORKSHOP COMPLETION · NOT PROFESSIONAL ACCREDITATION</text>
  </svg>`
}
