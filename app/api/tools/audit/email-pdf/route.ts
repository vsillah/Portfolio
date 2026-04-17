import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, isAuthError } from '@/lib/auth-server'
import { getDiagnosticAudit } from '@/lib/diagnostic'
import { userOwnsAudit } from '@/lib/audit-report-access'
import { auditRecordToPdfData, generateAuditReportPDFBuffer } from '@/lib/audit-report-pdf'
import { sendEmail } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

/**
 * POST /api/tools/audit/email-pdf
 * Body: { auditId: string }
 * Sends a printable PDF of the completed audit to the signed-in user's email.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request)
    if (isAuthError(auth)) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => ({}))
    const auditId = typeof body.auditId === 'string' ? body.auditId.trim() : ''
    if (!auditId) {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 })
    }

    const userId = auth.user.id
    const email = (auth.user.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ error: 'Your account has no email address' }, { status: 400 })
    }

    const owns = await userOwnsAudit(auditId, userId, email)
    if (!owns) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 404 })
    }

    const result = await getDiagnosticAudit(auditId)
    if (result.error || !result.data) {
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 404 })
    }

    const audit = result.data
    if (audit.status !== 'completed') {
      return NextResponse.json({ error: 'Report is not complete yet.' }, { status: 400 })
    }

    const pdfData = auditRecordToPdfData(audit)
    const buffer = await generateAuditReportPDFBuffer(pdfData)
    const filename = `ai-automation-audit-${auditId}.pdf`

    const brand = process.env.EMAIL_FROM_NAME || 'AmaduTown'
    const ok = await sendEmail(
      {
        to: email,
        subject: 'Your AI & Automation Audit (PDF attached)',
        text: [
          'Hi,',
          '',
          'Attached is a printable PDF of your AI & Automation audit report.',
          '',
          `— ${brand}`,
        ].join('\n'),
        html: `<p>Hi,</p><p>Attached is a printable PDF of your <strong>AI &amp; Automation audit</strong> report.</p><p>— ${brand}</p>`,
        attachments: [
          { filename, content: buffer, contentType: 'application/pdf' },
        ],
      },
      {
        emailKind: 'audit_pdf',
        sourceSystem: 'tools_audit',
        sourceId: auditId,
        metadata: { audit_id: auditId },
      },
    )

    if (!ok) {
      return NextResponse.json(
        { error: 'We could not send the email. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Audit email PDF error:', e)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
