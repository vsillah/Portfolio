/** The approved Accelerated frame and layout are the Portfolio course-certificate master. */
export const COURSE_CERTIFICATE_FRAME = '/accelerated/certificate-frame.png'
export const COURSE_CERTIFICATE_SIZE = { width: 1424, height: 1104 } as const

export type CourseCertificateCopy = {
  course: string
  subtitle: string
  completion: string
  ownerTitle: string
  ink: string
  accent: string
}

export const AGENTIFIED_CERTIFICATE_COPY: CourseCertificateCopy = {
  course: 'AGENTIFIED',
  subtitle: 'Build a Governed Agent Operating System',
  completion: 'has completed all sixteen lessons in the workshop',
  ownerTitle: 'Founder, AmaduTown',
  ink: '#153d43',
  accent: '#35766f',
}

export const certificateXml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character] ?? character)

function nameLines(value: string) {
  const limit = value.length > 80 ? 34 : 40
  const words = value.trim().split(/\s+/).flatMap((word) => word.match(new RegExp(`.{1,${limit}}`, 'gu')) ?? [])
  const lines: string[] = []
  for (const word of words) {
    const last = lines.length - 1
    if (last >= 0 && `${lines[last]} ${word}`.length <= limit) lines[last] += ` ${word}`
    else lines.push(word)
  }
  return lines.length <= 4 ? lines : [...lines.slice(0, 3), lines.slice(3).join(' ')]
}

/** Fixed frame geometry mirrors Accelerated; copy, ink and identity remain course-specific. */
export function renderCourseCertificateSvg(input: {
  copy: CourseCertificateCopy
  learner: string
  claimed: boolean
  date: string
  record: string
  verification: string
  assets?: { frame: string; logo: string; signature: string }
}) {
  const { copy, learner, claimed, date, record, verification, assets } = input
  const lines = nameLines(learner)
  const size = lines.length === 1 ? Math.max(48, Math.min(64, 940 / Math.max(learner.length * .55, 1))) : lines.length === 2 ? 56 : lines.length === 3 ? 39 : 34
  const firstY = lines.length === 1 ? 576 : lines.length === 2 ? 542 : lines.length === 3 ? 505 : 486
  const lineHeight = lines.length === 4 ? 37 : lines.length === 3 ? 43 : 46
  const ruleY = lines.length >= 3 ? 630 : 618
  const xml = certificateXml
  const frame = xml(assets?.frame || COURSE_CERTIFICATE_FRAME)
  const logo = xml(assets?.logo || '/amadutown-logo-upscaled.png')
  const signature = xml(assets?.signature || '/accelerated/vambah-signature.png')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1424" height="1104" viewBox="0 0 1424 1104" role="img" aria-labelledby="course-certificate-title course-certificate-description">
    <title id="course-certificate-title">${xml(copy.course)} workshop completion certificate</title>
    <desc id="course-certificate-description">${xml(learner)}${claimed ? ` completed ${xml(copy.course)} on ${xml(date)}` : ' may claim this certificate after completing the workshop'}.</desc>
    <image href="${frame}" x="0" y="0" width="1424" height="1104" preserveAspectRatio="none"/>
    <image href="${logo}" x="670" y="105" width="84" height="104" preserveAspectRatio="xMidYMid meet"/>
    <text x="712" y="257" fill="${copy.ink}" font-family="Arial,sans-serif" font-size="18" font-weight="700" text-anchor="middle" letter-spacing="8">AMADUTOWN</text>
    <text x="712" y="379" fill="${copy.ink}" font-family="Georgia,serif" font-size="61" font-weight="600" text-anchor="middle" letter-spacing="1">CERTIFICATE OF COMPLETION</text>
    <line x1="394" y1="412" x2="1030" y2="412" stroke="#a57413" stroke-width="1.4"/><path d="M690 412l22-20 22 20-22 20z" fill="none" stroke="#a57413" stroke-width="2"/>
    <text x="712" y="488" fill="#263b47" font-family="Georgia,serif" font-size="25" text-anchor="middle">This certifies that</text>
    ${lines.map((line, index) => `<text x="712" y="${firstY + index * lineHeight}" fill="${copy.ink}" font-family="Georgia,serif" font-size="${size}" font-weight="600" text-anchor="middle" textLength="${Math.min(1020, Math.max(1, line.length * size * .54))}" lengthAdjust="spacingAndGlyphs">${xml(line)}</text>`).join('')}
    <line x1="340" y1="${ruleY}" x2="1084" y2="${ruleY}" stroke="#a57413" stroke-width="1.2"/>
    <text x="712" y="678" fill="#263b47" font-family="Georgia,serif" font-size="25" text-anchor="middle">${xml(copy.completion)}</text>
    <text x="712" y="755" fill="${copy.ink}" font-family="Georgia,serif" font-size="45" font-weight="700" text-anchor="middle" letter-spacing="12">${xml(copy.course)}</text>
    <text x="712" y="794" fill="${copy.accent}" font-family="Georgia,serif" font-size="27" font-weight="600" text-anchor="middle">${xml(copy.subtitle)}</text>
    <text x="184" y="840" fill="#a57413" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="3">ISSUE DATE</text>
    <text x="184" y="874" fill="${copy.ink}" font-family="Georgia,serif" font-size="21">${xml(date)}</text>
    <image href="${signature}" x="517" y="816" width="390" height="112" preserveAspectRatio="xMidYMid meet"/>
    <line x1="518" y1="917" x2="906" y2="917" stroke="${copy.ink}" stroke-width="1.3"/>
    <text x="712" y="950" fill="${copy.ink}" font-family="Georgia,serif" font-size="25" font-weight="700" text-anchor="middle">Vambah Sillah</text>
    <text x="712" y="978" fill="${copy.ink}" font-family="Georgia,serif" font-size="18" text-anchor="middle">${xml(copy.ownerTitle)}</text>
    <text x="1240" y="828" fill="#a57413" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" text-anchor="end">CREDENTIAL RECORD ID</text>
    <text x="1240" y="861" fill="${copy.ink}" font-family="Georgia,serif" font-size="18" text-anchor="end">${xml(record)}</text>
    <text x="1240" y="897" fill="#a57413" font-family="Arial,sans-serif" font-size="14" font-weight="700" letter-spacing="2" text-anchor="end">VERIFICATION REFERENCE</text>
    <text x="1240" y="928" fill="${copy.ink}" font-family="Georgia,serif" font-size="16" text-anchor="end">${xml(verification)}</text>
  </svg>`
}
