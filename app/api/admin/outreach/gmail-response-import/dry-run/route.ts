import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  planWarmOutreachGmailResponseImport,
  type WarmOutreachGmailResponseImportActivationInput,
  type WarmOutreachGmailImportPortfolioRows,
  type WarmOutreachGmailReplyPayload,
} from '@/lib/warm-outreach-gmail-response-import'

export const dynamic = 'force-dynamic'

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status })
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function parseReplies(value: unknown): WarmOutreachGmailReplyPayload[] | null {
  if (!Array.isArray(value)) return null
  const replies = value.filter(isObject).map((reply) => ({
    provider: 'gmail' as const,
    threadId: typeof reply.threadId === 'string' ? reply.threadId : null,
    messageId: typeof reply.messageId === 'string' ? reply.messageId : null,
    historyId: typeof reply.historyId === 'string' ? reply.historyId : null,
    from: typeof reply.from === 'string' ? reply.from : null,
    to: Array.isArray(reply.to) || typeof reply.to === 'string' ? reply.to as string[] | string : null,
    cc: Array.isArray(reply.cc) || typeof reply.cc === 'string' ? reply.cc as string[] | string : null,
    subject: typeof reply.subject === 'string' ? reply.subject : null,
    text: typeof reply.text === 'string' ? reply.text : null,
    snippet: typeof reply.snippet === 'string' ? reply.snippet : null,
    receivedAt: typeof reply.receivedAt === 'string' ? reply.receivedAt : null,
    sourceUrl: typeof reply.sourceUrl === 'string' ? reply.sourceUrl : null,
    inReplyTo: typeof reply.inReplyTo === 'string' ? reply.inReplyTo : null,
    references: Array.isArray(reply.references) || typeof reply.references === 'string'
      ? reply.references as string[] | string
      : null,
    queueId: typeof reply.queueId === 'string' ? reply.queueId : null,
    contactId: typeof reply.contactId === 'number' || typeof reply.contactId === 'string'
      ? reply.contactId as number | string
      : null,
  }))
  return replies.length === value.length ? replies : null
}

function parseRows(value: unknown): WarmOutreachGmailImportPortfolioRows | null {
  if (!isObject(value)) return null
  return {
    contacts: Array.isArray(value.contacts) ? value.contacts.filter(isObject) : [],
    outreachQueue: Array.isArray(value.outreachQueue) ? value.outreachQueue.filter(isObject) : [],
    contactCommunications: Array.isArray(value.contactCommunications)
      ? value.contactCommunications.filter(isObject)
      : [],
    emailMessages: Array.isArray(value.emailMessages) ? value.emailMessages.filter(isObject) : [],
    actionTasks: Array.isArray(value.actionTasks) ? value.actionTasks.filter(isObject) : [],
  }
}

function parseStringList(value: unknown): string[] | string | null | undefined {
  if (value == null) return value as null | undefined
  if (typeof value === 'string') return value
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value
  }
  return undefined
}

function parseActivation(value: unknown): WarmOutreachGmailResponseImportActivationInput | undefined {
  if (!isObject(value)) return undefined
  const grantedScopes = parseStringList(value.grantedScopes ?? value.scope)
  const requiredScopes = parseStringList(value.requiredScopes)
  return {
    providerDisabled: typeof value.providerDisabled === 'boolean' ? value.providerDisabled : undefined,
    providerConfigured: typeof value.providerConfigured === 'boolean' ? value.providerConfigured : undefined,
    gmailTokenAvailable: typeof value.gmailTokenAvailable === 'boolean' ? value.gmailTokenAvailable : undefined,
    grantedScopes,
    requiredScopes: Array.isArray(requiredScopes) ? requiredScopes : undefined,
    liveImportRequested: typeof value.liveImportRequested === 'boolean' ? value.liveImportRequested : undefined,
  }
}

/**
 * POST /api/admin/outreach/gmail-response-import/dry-run
 *
 * Admin-only mock Gmail reply import planner. It accepts mocked provider
 * payloads and Portfolio-shaped local rows, then returns the local evidence that
 * would be reviewed through the existing warm response lifecycle. It never calls
 * Gmail, creates Gmail drafts, sends Slack/n8n messages, or writes database rows.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) return jsonError(auth.error, auth.status)

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!isObject(body)) return jsonError('Invalid JSON body', 400)
  if (body.dryRun === false) {
    return jsonError('Only dry-run Gmail response import planning is enabled.', 403)
  }
  if (body.liveProviderImportEnabled === true || body.providerPollingEnabled === true) {
    return jsonError('Live Gmail response import and provider polling are disabled for this route.', 403)
  }

  const replies = parseReplies(body.replies)
  if (!replies) return jsonError('replies must be an array of mocked Gmail reply payloads.', 400)

  const portfolioRows = parseRows(body.portfolioRows)
  if (!portfolioRows) {
    return jsonError('portfolioRows must include local Portfolio-shaped rows for dry-run matching.', 400)
  }
  const activation = parseActivation(
    body.gmailProviderReadiness ?? body.providerReadiness ?? body.activationReadiness,
  )

  const plan = planWarmOutreachGmailResponseImport({
    replies,
    rows: portfolioRows,
    dryRunImportEnabled: body.dryRunImportEnabled !== false,
    activation,
    actor: auth.user.id,
    observedAt: new Date().toISOString(),
    liveReadApprovalRequested: body.liveReadApprovalRequested === true,
  })

  return NextResponse.json({
    plan,
    executionBoundary: {
      localRowsOnly: true,
      dryRun: true,
      liveProviderImportEnabled: false,
      providerPollingEnabled: false,
      gmailApiCalled: false,
      externalActionsEnabled: false,
      gmailDraftCreationEnabled: false,
      gmailSendEnabled: false,
      slackDispatchEnabled: false,
      n8nDispatchEnabled: false,
      databaseWritesEnabled: false,
    },
  })
}
