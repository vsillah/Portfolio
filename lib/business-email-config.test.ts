import { afterEach, describe, expect, it } from 'vitest'
import {
  extractEmailAddress,
  formatMailboxAddress,
  resolveBusinessEmailConfig,
} from './business-email-config'

const BASE_ENV = { ...process.env }

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in BASE_ENV)) delete process.env[key]
  }
  Object.assign(process.env, BASE_ENV)
}

function setEnv(overrides: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

describe('business email config', () => {
  afterEach(() => {
    restoreEnv()
  })

  it('uses AmaduTown defaults instead of personal Gmail fallbacks', () => {
    setEnv({
      BUSINESS_FROM_EMAIL: undefined,
      BUSINESS_REPLY_TO_EMAIL: undefined,
      ADMIN_NOTIFICATION_EMAIL: undefined,
      AUTOMATION_INBOUND_EMAIL: undefined,
      EMAIL_FROM_NAME: undefined,
      BUSINESS_FROM_NAME: undefined,
      GMAIL_USER: undefined,
      RESEND_FROM_EMAIL: undefined,
    })

    expect(resolveBusinessEmailConfig()).toEqual({
      fromEmail: 'vambah@amadutown.com',
      replyToEmail: 'clients@amadutown.com',
      adminNotificationEmail: 'vambah@amadutown.com',
      automationInboundEmail: 'automation@amadutown.com',
      fromName: 'AmaduTown',
    })
  })

  it('separates client-facing sender, reply-to, admin, and automation inboxes', () => {
    setEnv({
      BUSINESS_FROM_EMAIL: 'vambah@amadutown.com',
      BUSINESS_REPLY_TO_EMAIL: 'clients@amadutown.com',
      ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
      AUTOMATION_INBOUND_EMAIL: 'automation@amadutown.com',
      EMAIL_FROM_NAME: 'AmaduTown Advisory',
      GMAIL_USER: 'transport@example.com',
    })

    expect(resolveBusinessEmailConfig()).toEqual({
      fromEmail: 'vambah@amadutown.com',
      replyToEmail: 'clients@amadutown.com',
      adminNotificationEmail: 'admin@example.com',
      automationInboundEmail: 'automation@amadutown.com',
      fromName: 'AmaduTown Advisory',
    })
  })

  it('extracts email addresses from mailbox strings', () => {
    expect(extractEmailAddress('"AmaduTown" <hello@amadutown.com>')).toBe('hello@amadutown.com')
    expect(extractEmailAddress('plain@example.com')).toBe('plain@example.com')
    expect(extractEmailAddress('not-an-email')).toBeNull()
  })

  it('formats mailbox addresses safely', () => {
    expect(formatMailboxAddress('Amadu "Ops"', 'automation@amadutown.com')).toBe(
      '"Amadu \\"Ops\\"" <automation@amadutown.com>',
    )
  })
})
