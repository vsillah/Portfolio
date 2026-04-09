import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToN8n, sendDiagnosticToN8n, generateSessionId, triggerDiagnosticCompletionWebhook, triggerLeadQualificationWebhook, type ChatMessage } from '@/lib/n8n'
import type { DiagnosticProgress, DiagnosticCategory } from '@/lib/n8n'
import { saveDiagnosticAudit, getDiagnosticAuditBySession, linkDiagnosticToContact } from '@/lib/diagnostic'
import { findOrCreateContactByEmail } from '@/lib/find-or-create-contact'
import { getAuthUserPrimaryEmail } from '@/lib/auth-user-email'
import { getClientIpFromRequest, isIpRateLimited } from '@/lib/simple-ip-rate-limit'
import { isValidCalendlyUrl } from '@/lib/utils'
import { fetchConversationContext } from '@/lib/chat-context'
import { createChatEscalation, formatTranscriptFromHistory } from '@/lib/chat-escalation'
import { fetchClientContext, formatClientContextForAI } from '@/lib/chat-client-context'
import { getSystemPrompt } from '@/lib/system-prompts'
import { chatMessageSchema, zodErrorResponse } from '@/lib/chat-validation'

export const dynamic = 'force-dynamic'
/** Allow up to 60s so n8n diagnostic call can complete and response reaches the client */
export const maxDuration = 60

// Diagnostic trigger phrases (same as in Chat.tsx)
const DIAGNOSTIC_TRIGGERS = [
  'audit',
  'diagnostic',
  'identify issues',
  'help me identify',
  'self-assessment',
  'business assessment',
  'analyze my',
  'evaluate my',
  'review my',
]

function detectDiagnosticIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return DIAGNOSTIC_TRIGGERS.some(trigger => lowerMessage.includes(trigger))
}

function isE2ETestClientRequest(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') || ''
  return ua.includes('E2E-Test-Client/')
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate limit (per-IP, 20 req/min) — skip for server-side E2E simulator ──
    const ip = getClientIpFromRequest(request)
    if (!isE2ETestClientRequest(request) && isIpRateLimited('chat_message', ip)) {
      console.warn('[chat] chat_message rate limited', { ip: ip.slice(0, 12) })
      return NextResponse.json(
        { error: "You're sending messages too quickly. Please wait a moment.", retriable: true },
        { status: 429 }
      )
    }

    // ── Parse & validate body (Zod) ──
    const body = await request.json()
    const parsed = chatMessageSchema.parse(body)

    const visitorEmail = parsed.visitorEmail || undefined
    const visitorName = parsed.visitorName || undefined
    const providedSessionId = parsed.sessionId
    const providedDiagnosticMode = parsed.diagnosticMode
    const providedDiagnosticAuditId = parsed.diagnosticAuditId
    const providedDiagnosticProgress = parsed.diagnosticProgress
    const message = parsed.message

    // ── Derive userId from Authorization header (never trust client body) ──
    let userId: string | undefined
    const authHeader = request.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''))
        if (user) userId = user.id
      } catch {
        // Non-fatal: proceed as anonymous visitor
      }
    }

    const sessionId = providedSessionId || generateSessionId()

    // Detect diagnostic intent if not already in diagnostic mode
    const shouldStartDiagnostic = !providedDiagnosticMode && detectDiagnosticIntent(message)
    const isDiagnosticMode = providedDiagnosticMode || shouldStartDiagnostic

    // Check if session exists, create if not
    const { data: existingSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (!existingSession) {
      // Record prompt version at session creation for eval correlation
      let promptVersion: number | undefined
      try {
        const prompt = await getSystemPrompt(isDiagnosticMode ? 'diagnostic' : 'chatbot')
        if (prompt?.version != null) promptVersion = prompt.version
      } catch {
        // Non-fatal: session still created, version just omitted
      }
      const { error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          visitor_email: visitorEmail || null,
          visitor_name: visitorName || null,
          ...(userId ? { user_id: userId } : {}),
          ...(promptVersion != null ? { prompt_version: promptVersion } : {}),
        })

      if (sessionError) {
        console.error('Error creating chat session:', sessionError)
      }
    } else if (visitorEmail || visitorName || userId) {
      await supabaseAdmin
        .from('chat_sessions')
        .update({
          visitor_email: visitorEmail || undefined,
          visitor_name: visitorName || undefined,
          ...(userId ? { user_id: userId } : {}),
        })
        .eq('session_id', sessionId)
    }

    // Get or create diagnostic audit if in diagnostic mode
    let diagnosticAuditId: string | null = providedDiagnosticAuditId || null
    let currentDiagnosticProgress: DiagnosticProgress | null = providedDiagnosticProgress || null

    if (isDiagnosticMode) {
      // Check for existing diagnostic audit
      if (!diagnosticAuditId) {
        const { data: existingAudit } = await getDiagnosticAuditBySession(sessionId)
        if (existingAudit && existingAudit.status === 'in_progress') {
          diagnosticAuditId = existingAudit.id
          currentDiagnosticProgress = {
            completedCategories: [],
            questionsAsked: existingAudit.questions_asked || [],
            responsesReceived: existingAudit.responses_received || {},
          }
        }
      }

      // Create new diagnostic audit if needed
      if (!diagnosticAuditId) {
        const result = await saveDiagnosticAudit(sessionId, {
          status: 'in_progress',
        })
        if (result.id) {
          diagnosticAuditId = result.id
        }
      }
    }

    // Save user message to database
    const { error: userMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message.trim(),
        metadata: { 
          source: 'chatbot',
          channel: 'chatbot',
          visitorEmail, 
          visitorName,
          diagnosticMode: isDiagnosticMode,
          diagnosticAuditId: diagnosticAuditId || undefined,
          timestamp: new Date().toISOString(),
        },
      })

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
    }

    // Track timing for latency measurement
    const requestStartTime = Date.now()

    // Fetch conversation history for context injection (non-fatal if it fails)
    let context: Awaited<ReturnType<typeof fetchConversationContext>> = null
    try {
      context = await fetchConversationContext(sessionId, 20)
    } catch (ctxErr) {
      console.warn('Context fetch failed (non-fatal):', ctxErr instanceof Error ? ctxErr.message : ctxErr)
    }

    // Format history for N8N
    const history: ChatMessage[] = context?.history.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      source: msg.source,
    })) || []

    // Detect if this is a cross-channel conversation
    const hasCrossChannelHistory = context?.sessionInfo.hasTextMessages && context?.sessionInfo.hasVoiceMessages

    // Fetch authenticated client context (non-fatal)
    let clientContextSummary: string | undefined
    if (userId) {
      try {
        const ctx = await fetchClientContext(userId)
        if (ctx) {
          clientContextSummary = formatClientContextForAI(ctx)
        }
      } catch (ctxErr) {
        console.warn('Client context fetch failed (non-fatal):', ctxErr instanceof Error ? ctxErr.message : ctxErr)
      }
    }

    // ── Send to n8n (all paths now return fallback responses instead of throwing) ──
    let n8nResponse
    let diagnosticResponse = null
    let diagnosticComplete = false
    let currentCategory: DiagnosticCategory | undefined = undefined

    if (isDiagnosticMode && diagnosticAuditId) {
      // Diagnostic mode — sendDiagnosticToN8n already handles retries + fallback internally
      diagnosticResponse = await sendDiagnosticToN8n({
        sessionId,
        diagnosticAuditId,
        message: message.trim(),
        currentCategory: currentDiagnosticProgress?.currentCategory,
        progress: currentDiagnosticProgress || undefined,
        visitorEmail,
        visitorName,
      })

      // Update diagnostic progress
      if (diagnosticResponse.progress) {
        currentDiagnosticProgress = diagnosticResponse.progress
      }
      if (diagnosticResponse.currentCategory) {
        currentCategory = diagnosticResponse.currentCategory
      }
      if (diagnosticResponse.isComplete) {
        diagnosticComplete = true
      }

      // Save diagnostic data incrementally (only if we got real data, not a fallback)
      if (diagnosticResponse.diagnosticData && diagnosticAuditId && !diagnosticResponse.metadata?.fallback) {
        await saveDiagnosticAudit(sessionId, {
          diagnosticAuditId,
          currentCategory: diagnosticResponse.currentCategory,
          progress: diagnosticResponse.progress,
          diagnosticData: diagnosticResponse.diagnosticData,
          status: diagnosticResponse.isComplete ? 'completed' : 'in_progress',
          questionsByCategory: diagnosticResponse.metadata?.questionsByCategory as import('@/lib/diagnostic').QuestionsByCategory | undefined,
        })
      }

      // Handle diagnostic completion (only if not a fallback response).
      // Soft gate: audit is already saved completed above; Gamma runs only after contact_submission_id exists
      // (saveDiagnosticAudit enqueue skipped without contact; linkDiagnosticToContact enqueues after link).
      if (diagnosticComplete && diagnosticAuditId && diagnosticResponse.diagnosticData && !diagnosticResponse.metadata?.fallback) {
        const emailForContact =
          (typeof visitorEmail === 'string' && visitorEmail.trim().toLowerCase()) ||
          (userId ? await getAuthUserPrimaryEmail(userId) : null)

        const ip = getClientIpFromRequest(request)
        const sideEffectsBlocked = isIpRateLimited('chat_diagnostic_complete', ip)
        if (sideEffectsBlocked) {
          console.warn('[chat] chat_diagnostic_complete rate limited', { ip: ip.slice(0, 12), diagnosticAuditId })
        }

        if (emailForContact && !sideEffectsBlocked) {
          const contactId = await findOrCreateContactByEmail(emailForContact, {
            name: visitorName?.trim() || undefined,
            message: `Diagnostic completed via chat. ${diagnosticResponse.diagnosticData.diagnostic_summary || ''}`.slice(0, 2000),
            leadSource: 'website_form',
          })
          if (contactId) {
            await linkDiagnosticToContact(diagnosticAuditId, contactId)

            triggerLeadQualificationWebhook({
              name: visitorName || emailForContact.split('@')[0] || 'Unknown',
              email: emailForContact,
              message: `Diagnostic completed. ${diagnosticResponse.diagnosticData.diagnostic_summary || 'See diagnostic audit for details.'}`,
              submissionId: contactId.toString(),
              submittedAt: new Date().toISOString(),
              source: 'chat_diagnostic',
            }).catch((err) => console.error('Lead qualification webhook failed:', err))
          }
        }

        triggerDiagnosticCompletionWebhook(
          diagnosticAuditId,
          diagnosticResponse.diagnosticData as any,
          { email: emailForContact ?? undefined, name: visitorName }
        ).catch((err) => console.error('Diagnostic completion webhook failed:', err))
      }

      n8nResponse = {
        response: diagnosticResponse.response,
        escalated: false,
        metadata: diagnosticResponse.metadata || {},
      }
    } else {
      n8nResponse = await sendToN8n({
        message: message.trim(),
        sessionId,
        visitorEmail,
        visitorName,
        diagnosticMode: false,
        source: 'text',
        history,
        conversationSummary: context?.summary,
        hasCrossChannelHistory,
        ...(clientContextSummary ? { clientContext: clientContextSummary } : {}),
      })
    }

    // Calculate response latency
    const responseLatencyMs = Date.now() - requestStartTime

    // Save assistant response to database with enhanced metadata for evaluation
    const { error: assistantMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: n8nResponse.escalated ? 'support' : 'assistant',
        content: n8nResponse.response,
        metadata: {
          source: 'chatbot',
          channel: 'chatbot',
          hasCrossChannelHistory,
          latency_ms: responseLatencyMs,
          timestamp: new Date().toISOString(),
          ...n8nResponse.metadata,
          diagnosticMode: isDiagnosticMode,
          diagnosticAuditId: diagnosticAuditId || undefined,
          escalated: n8nResponse.escalated || false,
        },
      })

    if (assistantMsgError) {
      console.error('Error saving assistant message:', assistantMsgError)
    }

    // Update session if escalated
    if (n8nResponse.escalated) {
      await supabaseAdmin
        .from('chat_sessions')
        .update({ is_escalated: true })
        .eq('session_id', sessionId)

      // Persist escalation and notify Slack (fire-and-forget)
      const transcriptLines = context?.history ? formatTranscriptFromHistory(context.history) : ''
      const fullTranscript = [transcriptLines, `User: ${message.trim()}`, `Assistant: ${n8nResponse.response}`].filter(Boolean).join('\n\n')
      createChatEscalation({
        sessionId,
        source: 'text',
        reason: (n8nResponse.metadata?.fallback as boolean) ? 'fallback' : 'user_requested_human',
        visitorName: visitorName ?? context?.sessionInfo?.visitorName ?? null,
        visitorEmail: visitorEmail ?? context?.sessionInfo?.visitorEmail ?? null,
        transcript: fullTranscript,
      }).catch(() => {})
    }

    // Final safeguard - ensure response is always a string
    let finalResponse: string = n8nResponse.response
    const responseValue = n8nResponse.response as unknown
    if (typeof responseValue === 'object' && responseValue !== null) {
      const responseObj = responseValue as Record<string, unknown>
      finalResponse = String(responseObj.response || responseObj.text || responseObj.message || JSON.stringify(responseValue))
    } else if (typeof responseValue === 'string') {
      finalResponse = responseValue
      try {
        const parsed = JSON.parse(responseValue)
        if (parsed && typeof parsed === 'object' && parsed.response) {
          finalResponse = parsed.response
        }
      } catch {
        // Not JSON, use as-is
      }
    }

    // Server-side fallback: extract Calendly metadata from response text if n8n didn't
    const metadata: Record<string, unknown> = { ...n8nResponse.metadata }
    if (!metadata.action) {
      const calendlyMatch = finalResponse.match(/\{\s*"action"\s*:\s*"schedule_meeting"\s*,\s*"calendlyUrl"\s*:\s*"([^"]+)"\s*\}/)
      if (calendlyMatch && isValidCalendlyUrl(calendlyMatch[1])) {
        metadata.action = 'schedule_meeting'
        metadata.calendlyUrl = calendlyMatch[1]
        finalResponse = finalResponse.replace(calendlyMatch[0], '').trim()
      }
    }
    // Never expose invalid Calendly URLs to the client
    if (metadata.action === 'schedule_meeting' && !isValidCalendlyUrl(metadata.calendlyUrl as string | undefined)) {
      delete metadata.action
      delete metadata.calendlyUrl
    }

    return NextResponse.json({
      response: String(finalResponse || ''),
      sessionId,
      escalated: n8nResponse.escalated,
      metadata,
      diagnosticMode: isDiagnosticMode,
      diagnosticAuditId: diagnosticAuditId || undefined,
      diagnosticProgress: currentDiagnosticProgress || undefined,
      currentCategory: currentCategory,
      diagnosticComplete: diagnosticComplete,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      const { error: msg, detail, status } = zodErrorResponse(error)
      return NextResponse.json({ error: msg, detail }, { status })
    }
    console.error('Chat API error:', error)
    return NextResponse.json(
      {
        error: 'Unable to process your message. Please try again or use the contact form.',
        fallback: true,
        retriable: true,
      },
      { status: 500 }
    )
  }
}
