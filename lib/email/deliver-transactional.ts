import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export interface TransactionalEmailPayload {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentType: string
  }>
}

export type TransactionalSendTransport = 'resend' | 'gmail_smtp' | 'logged_only'

export interface TransactionalSendOutcome {
  ok: boolean
  transport: TransactionalSendTransport
  providerMessageId?: string
}

const gmailUser = process.env.GMAIL_USER
const gmailPass = process.env.GMAIL_APP_PASSWORD
const fromName = process.env.EMAIL_FROM_NAME || 'ATAS'
const resendKey = process.env.RESEND_API_KEY?.trim()
const resendFromRaw = process.env.RESEND_FROM_EMAIL?.trim()

const transporter =
  gmailUser && gmailPass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      })
    : null

function resolveResendFrom(): string | null {
  if (!resendFromRaw) return null
  if (resendFromRaw.includes('<') && resendFromRaw.includes('>')) return resendFromRaw
  return `"${fromName}" <${resendFromRaw}>`
}

async function sendViaResend(
  payload: TransactionalEmailPayload,
): Promise<{ ok: true; id: string } | { ok: false }> {
  if (!resendKey) return { ok: false }
  const from = resolveResendFrom()
  if (!from) {
    console.warn('[Transactional email] RESEND_API_KEY set but RESEND_FROM_EMAIL missing')
    return { ok: false }
  }
  const resend = new Resend(resendKey)
  const { data, error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      ...(a.contentType ? { contentType: a.contentType } : {}),
    })),
  })
  if (error) {
    console.error('[Transactional email] Resend error:', error.message)
    return { ok: false }
  }
  if (!data?.id) return { ok: false }
  return { ok: true, id: data.id }
}

async function sendViaGmail(payload: TransactionalEmailPayload): Promise<boolean> {
  if (!transporter || !gmailUser) return false
  try {
    await transporter.sendMail({
      from: `"${fromName}" <${gmailUser}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      attachments: payload.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    })
    return true
  } catch (err) {
    console.error('[Transactional email] Gmail send failed:', err)
    return false
  }
}

/**
 * Sends transactional mail: Resend when API key + from are configured (Gmail SMTP as fallback),
 * otherwise Gmail only, otherwise log-only success (no provider).
 */
export async function deliverTransactionalMail(
  payload: TransactionalEmailPayload,
): Promise<TransactionalSendOutcome> {
  const useResend = Boolean(resendKey && resolveResendFrom())

  if (useResend) {
    const r = await sendViaResend(payload)
    if (r.ok) return { ok: true, transport: 'resend', providerMessageId: r.id }
    if (transporter && gmailUser) {
      const ok = await sendViaGmail(payload)
      if (ok) return { ok: true, transport: 'gmail_smtp' }
    }
    return { ok: false, transport: 'resend' }
  }

  if (transporter && gmailUser) {
    const ok = await sendViaGmail(payload)
    if (ok) return { ok: true, transport: 'gmail_smtp' }
    return { ok: false, transport: 'gmail_smtp' }
  }

  console.warn('[Transactional email] No provider configured — treating as logged-only success:', {
    to: payload.to,
    subject: payload.subject,
    textPreview: payload.text?.slice(0, 100) || payload.html.slice(0, 100),
  })
  return { ok: true, transport: 'logged_only' }
}
