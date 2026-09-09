import { buildPlaintextRfc2822, rfc2822ToGmailRaw } from '@/lib/gmail-message-copy'
export { buildPlaintextRfc2822, rfc2822ToGmailRaw } from '@/lib/gmail-message-copy'
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
): Promise<{ id: string; messageId?: string; threadId?: string }> {
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
  const threadId = res.data.message?.threadId ?? undefined
  if (!id) {
    throw new Error('Gmail API returned no draft id')
  }
  return { id, messageId, threadId }
}

export async function updateUserGmailDraft(
  refreshToken: string,
  draftId: string,
  reviewedCopy: { to: string; subject: string; body: string },
): Promise<{ id: string; messageId?: string; threadId?: string }> {
  const raw = rfc2822ToGmailRaw(buildPlaintextRfc2822(reviewedCopy.to, reviewedCopy.subject, reviewedCopy.body))
  const oauth2Client = getGmailUserOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const result = await gmail.users.drafts.update({ userId: 'me', id: draftId, requestBody: { id: draftId, message: { raw } } })
  if (result.data.id !== draftId) throw new Error('Gmail draft update identity is unconfirmed. Reconcile the mailbox before retrying.')
  return { id: result.data.id, messageId: result.data.message?.id ?? undefined, threadId: result.data.message?.threadId ?? undefined }
}

export async function sendUserGmailDraft(
  refreshToken: string,
  draftId: string,
  reviewedCopy?: { to: string; subject: string; body: string }
): Promise<{ id?: string; threadId?: string; labelIds?: string[] }> {
  const oauth2Client = getGmailUserOAuth2Client()
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  if (!reviewedCopy) throw new Error('Exact reviewed message is required. Open the Portfolio Gmail review before sending.')
  const raw = rfc2822ToGmailRaw(buildPlaintextRfc2822(reviewedCopy.to, reviewedCopy.subject, reviewedCopy.body))
  // Gmail replaces and sends the draft in one request: https://developers.google.com/workspace/gmail/api/guides/drafts#send_drafts
  const res = await gmail.users.drafts.send({
    userId: 'me',
    requestBody: { id: draftId, message: { raw } },
  })
  return {
    id: res.data.id ?? undefined,
    threadId: res.data.threadId ?? undefined,
    labelIds: res.data.labelIds ?? undefined,
  }
}
