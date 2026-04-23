import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
  resendSend: vi.fn(),
  resendCtor: vi.fn(),
}))

vi.mock('nodemailer', () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}))

class ResendMock {
  emails = {
    send: mocks.resendSend,
  }

  constructor(apiKey: string) {
    mocks.resendCtor(apiKey)
  }
}

vi.mock('resend', () => ({
  Resend: ResendMock,
}))

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

const payload = {
  to: 'client@example.com',
  subject: 'Subject',
  html: '<p>Hi</p>',
  text: 'Hi',
}

describe('deliverTransactionalMail', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    restoreEnv()
  })

  afterEach(() => {
    restoreEnv()
  })

  it('returns logged_only success when no provider is configured', async () => {
    setEnv({
      RESEND_API_KEY: undefined,
      RESEND_FROM_EMAIL: undefined,
      GMAIL_USER: undefined,
      GMAIL_APP_PASSWORD: undefined,
    })

    const { deliverTransactionalMail } = await import('./deliver-transactional')
    const result = await deliverTransactionalMail(payload)

    expect(result).toEqual({ ok: true, transport: 'logged_only' })
    expect(mocks.resendCtor).not.toHaveBeenCalled()
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it('uses resend and returns provider message id on success', async () => {
    setEnv({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'notifications@example.com',
      GMAIL_USER: undefined,
      GMAIL_APP_PASSWORD: undefined,
    })
    mocks.resendSend.mockResolvedValueOnce({ data: { id: 're_123' }, error: null })

    const { deliverTransactionalMail } = await import('./deliver-transactional')
    const result = await deliverTransactionalMail(payload)

    expect(mocks.resendCtor).toHaveBeenCalledWith('re_test_key')
    expect(mocks.resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"ATAS" <notifications@example.com>',
        to: 'client@example.com',
      }),
    )
    expect(result).toEqual({
      ok: true,
      transport: 'resend',
      providerMessageId: 're_123',
    })
  })

  it('falls back to gmail when resend fails and smtp is configured', async () => {
    setEnv({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'notifications@example.com',
      GMAIL_USER: 'sender@gmail.com',
      GMAIL_APP_PASSWORD: 'gmail-app-password',
    })
    mocks.createTransport.mockReturnValueOnce({
      sendMail: mocks.sendMail,
    })
    mocks.resendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'downstream error' },
    })
    mocks.sendMail.mockResolvedValueOnce({})

    const { deliverTransactionalMail } = await import('./deliver-transactional')
    const result = await deliverTransactionalMail(payload)

    expect(mocks.createTransport).toHaveBeenCalledTimes(1)
    expect(mocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"ATAS" <sender@gmail.com>',
        to: 'client@example.com',
      }),
    )
    expect(result).toEqual({ ok: true, transport: 'gmail_smtp' })
  })

  it('returns resend failure when resend is configured and gmail is unavailable', async () => {
    setEnv({
      RESEND_API_KEY: 're_test_key',
      RESEND_FROM_EMAIL: 'notifications@example.com',
      GMAIL_USER: undefined,
      GMAIL_APP_PASSWORD: undefined,
    })
    mocks.resendSend.mockResolvedValueOnce({
      data: null,
      error: { message: 'rejected' },
    })

    const { deliverTransactionalMail } = await import('./deliver-transactional')
    const result = await deliverTransactionalMail(payload)

    expect(result).toEqual({ ok: false, transport: 'resend' })
  })
})
