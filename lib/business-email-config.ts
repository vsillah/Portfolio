const DEFAULT_BUSINESS_FROM_EMAIL = 'vambah@amadutown.com'
const DEFAULT_BUSINESS_REPLY_TO_EMAIL = 'clients@amadutown.com'
const DEFAULT_AUTOMATION_INBOUND_EMAIL = 'automation@amadutown.com'
const DEFAULT_EMAIL_FROM_NAME = 'AmaduTown'

export interface BusinessEmailConfig {
  fromEmail: string
  replyToEmail: string
  adminNotificationEmail: string
  automationInboundEmail: string
  fromName: string
}

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function extractEmailAddress(value: string | undefined): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null

  const bracketed = trimmed.match(/<([^<>@\s]+@[^<>@\s]+)>/)
  if (bracketed?.[1]) return bracketed[1]

  return trimmed.includes('@') ? trimmed : null
}

export function getEmailFromName(): string {
  return clean(process.env.EMAIL_FROM_NAME) || clean(process.env.BUSINESS_FROM_NAME) || DEFAULT_EMAIL_FROM_NAME
}

export function resolveBusinessEmailConfig(): BusinessEmailConfig {
  const fromEmail =
    extractEmailAddress(process.env.BUSINESS_FROM_EMAIL) ||
    extractEmailAddress(process.env.RESEND_FROM_EMAIL) ||
    DEFAULT_BUSINESS_FROM_EMAIL

  const replyToEmail =
    extractEmailAddress(process.env.BUSINESS_REPLY_TO_EMAIL) ||
    DEFAULT_BUSINESS_REPLY_TO_EMAIL

  const adminNotificationEmail =
    extractEmailAddress(process.env.ADMIN_NOTIFICATION_EMAIL) ||
    extractEmailAddress(process.env.GMAIL_USER) ||
    fromEmail

  const automationInboundEmail =
    extractEmailAddress(process.env.AUTOMATION_INBOUND_EMAIL) || DEFAULT_AUTOMATION_INBOUND_EMAIL

  return {
    fromEmail,
    replyToEmail,
    adminNotificationEmail,
    automationInboundEmail,
    fromName: getEmailFromName(),
  }
}

export function formatMailboxAddress(name: string, email: string): string {
  const escapedName = name.replace(/"/g, '\\"')
  return `"${escapedName}" <${email}>`
}
