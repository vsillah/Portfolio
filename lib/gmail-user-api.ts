import { google } from 'googleapis'
import { signOAuthState } from '@/lib/gmail-user-oauth-state'

export const GMAIL_USER_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/userinfo.email',
] as const

export function isGmailUserOAuthClientConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GOOGLE_GMAIL_OAUTH_REDIRECT_URI?.trim()
  )
}

export function getGmailUserOAuth2Client() {
  const clientId = process.env.GOOGLE_GMAIL_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_GMAIL_OAUTH_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_GMAIL_OAUTH_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Gmail OAuth client is not configured')
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export function buildGmailUserAuthorizeUrl(userId: string): string {
  const oauth2Client = getGmailUserOAuth2Client()
  const state = signOAuthState(userId)
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...GMAIL_USER_OAUTH_SCOPES],
    state,
  })
}

function mimeEncodedSubject(subject: string): string {
  const line = subject.replace(/\r?\n/g, ' ').trim().slice(0, 200)
  const b = Buffer.from(line, 'utf8').toString('base64')
  return `=?UTF-8?B?${b}?=`
}

/** RFC 2822–style message; will be base64url-wrapped for Gmail API `raw`. */
export function buildPlaintextRfc2822(to: string, subject: string, body: string): string {
  const normalizedBody = body.replace(/\r?\n/g, '\n')
  const bodyB64 = Buffer.from(normalizedBody, 'utf8').toString('base64')
  const wrapped = bodyB64.match(/.{1,76}/g)?.join('\r\n') ?? bodyB64
  return [
    `To: ${to}`,
    `Subject: ${mimeEncodedSubject(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrapped,
  ].join('\r\n')
}

export function rfc2822ToGmailRaw(rfc: string): string {
  return Buffer.from(rfc, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = getGmailUserOAuth2Client()
  const { tokens } = await oauth2Client.getToken(code)
  return tokens
}

export async function fetchGoogleAccountEmail(
  refreshToken: string
): Promise<string | null> {
  const oauth2Client = getGmailUserOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  try {
    const { data } = await oauth2.userinfo.get()
    return data.email ?? null
  } catch (e) {
    console.error('[Gmail user OAuth] userinfo.get failed:', e)
    return null
  }
}

export async function createUserGmailDraft(
  refreshToken: string,
  params: { to: string; subject: string; body: string }
): Promise<{ id: string; messageId?: string }> {
  const oauth2Client = getGmailUserOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const rfc = buildPlaintextRfc2822(params.to, params.subject, params.body)
  const raw = rfc2822ToGmailRaw(rfc)
  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw },
    },
  })
  const id = res.data.id
  const messageId = res.data.message?.id ?? undefined
  if (!id) {
    throw new Error('Gmail API returned no draft id')
  }
  return { id, messageId }
}
