import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ send: vi.fn(), update: vi.fn(), setCredentials: vi.fn() }))
vi.mock('googleapis', () => ({ google: { auth: { OAuth2: class { setCredentials = mocks.setCredentials } }, gmail: () => ({ users: { drafts: { send: mocks.send, update: mocks.update } } }) } }))
import { sendUserGmailDraft, updateUserGmailDraft } from '@/lib/gmail-user-api'
import { buildPlaintextRfc2822 } from '@/lib/gmail-message-copy'
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('GOOGLE_GMAIL_OAUTH_CLIENT_ID', 'synthetic-client')
  vi.stubEnv('GOOGLE_GMAIL_OAUTH_CLIENT_SECRET', 'synthetic-secret')
  vi.stubEnv('GOOGLE_GMAIL_OAUTH_REDIRECT_URI', 'http://localhost/callback')
  mocks.send.mockResolvedValue({ data: { id: 'sent-1', threadId: 'thread-1' } })
})
afterEach(() => vi.unstubAllEnvs())
describe('immutable reviewed Gmail send', () => {
  it('updates only the known draft with the approved replacement MIME', async () => {
    mocks.update.mockResolvedValue({ data: { id: 'known-draft', message: { id: 'updated-message', threadId: 'thread-1' } } })
    const result = await updateUserGmailDraft('token', 'known-draft', { to: 'reviewed@example.test', subject: 'Revised', body: 'New approved copy' })
    expect(result).toEqual({ id: 'known-draft', messageId: 'updated-message', threadId: 'thread-1' })
    const request = mocks.update.mock.calls[0][0]
    expect(request.id).toBe('known-draft')
    expect(Buffer.from(request.requestBody.message.raw, 'base64url').toString('utf8')).toBe(buildPlaintextRfc2822('reviewed@example.test', 'Revised', 'New approved copy'))
    expect(mocks.send).not.toHaveBeenCalled()
  })

  it('replaces mailbox content and sends the approved MIME in one request', async () => {
    const subject = `  ${'Long Unicode subject 世界 '.repeat(20)} `
    const body = 'Reviewed body\r\n\nNo attachment.'
    await sendUserGmailDraft('synthetic-refresh', 'existing-draft', { to: 'reviewed@example.test', subject, body })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    const request = mocks.send.mock.calls[0][0]
    expect(request.requestBody.id).toBe('existing-draft')
    const mime = Buffer.from(request.requestBody.message.raw, 'base64url').toString('utf8')
    const [headers, encodedBody] = mime.split('\r\n\r\n')
    expect(headers).toContain('To: reviewed@example.test')
    expect(headers).not.toMatch(/(?:^|\r\n)(?:Cc|Bcc|Content-Disposition):/i)
    expect(headers).not.toContain('multipart')
    const decodedSubject = [...headers.matchAll(/=\?UTF-8\?B\?([^?]*)\?=/g)].map(match => Buffer.from(match[1], 'base64').toString('utf8')).join('')
    expect(decodedSubject).toBe(subject)
    expect(Buffer.from(encodedBody.replace(/\r\n/g, ''), 'base64').toString('utf8')).toBe(body)
  })
  it.each(['a@example.test\r\nBcc: extra@example.test', 'a@example.test,b@example.test', 'Name <a@example.test>'])('rejects unsafe recipient headers: %s', async to => {
    await expect(sendUserGmailDraft('token', 'draft', { to, subject: 'Subject', body: 'Body' })).rejects.toThrow('one valid recipient')
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejects an ID-only legacy send before any provider request', async () => {
    await expect(sendUserGmailDraft('token', 'draft')).rejects.toThrow('Exact reviewed message is required')
    expect(mocks.send).not.toHaveBeenCalled()
  })
  it('rejects multiline subjects instead of silently rewriting them', () => {
    expect(() => buildPlaintextRfc2822('a@example.test', 'Subject\r\nBcc: extra', 'Body')).toThrow('single-line subject')
  })
})
