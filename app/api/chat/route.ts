import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToN8n, sendDiagnosticToN8n, generateSessionId, triggerDiagnosticCompletionWebhook, triggerLeadQualificationWebhook } from '@/lib/n8n'
import type { DiagnosticProgress, DiagnosticCategory } from '@/lib/n8n'
import { saveDiagnosticAudit, getDiagnosticAuditBySession, linkDiagnosticToContact } from '@/lib/diagnostic'

export const dynamic = 'force-dynamic'

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      message, 
      sessionId: providedSessionId, 
      visitorEmail, 
      visitorName,
      diagnosticMode: providedDiagnosticMode,
      diagnosticAuditId: providedDiagnosticAuditId,
      diagnosticProgress: providedDiagnosticProgress
    } = body

    // Validate message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Use provided session ID or generate a new one
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
      // Create new session
      const { error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          visitor_email: visitorEmail || null,
          visitor_name: visitorName || null,
        })

      if (sessionError) {
        console.error('Error creating chat session:', sessionError)
        // Continue anyway - we can still process the message
      }
    } else if (visitorEmail || visitorName) {
      // Update session with visitor info if provided
      await supabaseAdmin
        .from('chat_sessions')
        .update({
          visitor_email: visitorEmail || undefined,
          visitor_name: visitorName || undefined,
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
          visitorEmail, 
          visitorName,
          diagnosticMode: isDiagnosticMode,
          diagnosticAuditId: diagnosticAuditId || undefined,
        },
      })

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
    }

    // Send to n8n - use diagnostic workflow if in diagnostic mode
    let n8nResponse
    let diagnosticResponse = null
    let diagnosticComplete = false
    let currentCategory: DiagnosticCategory | undefined = undefined

    if (isDiagnosticMode && diagnosticAuditId) {
      // Use diagnostic-specific n8n workflow
      try {
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

        // Save diagnostic data incrementally
        if (diagnosticResponse.diagnosticData && diagnosticAuditId) {
          await saveDiagnosticAudit(sessionId, {
            diagnosticAuditId,
            currentCategory: diagnosticResponse.currentCategory,
            progress: diagnosticResponse.progress,
            diagnosticData: diagnosticResponse.diagnosticData,
            status: diagnosticResponse.isComplete ? 'completed' : 'in_progress',
          })
        }

        // Handle diagnostic completion
        if (diagnosticComplete && diagnosticAuditId && diagnosticResponse.diagnosticData) {
          // Link to contact submission if email provided
          if (visitorEmail) {
            // Find or create contact submission
            const { data: contactSubmissions } = await supabaseAdmin
              .from('contact_submissions')
              .select('id')
              .eq('email', visitorEmail.toLowerCase())
              .order('created_at', { ascending: false })
              .limit(1)

            if (contactSubmissions && contactSubmissions.length > 0) {
              await linkDiagnosticToContact(diagnosticAuditId, contactSubmissions[0].id)
              
              // Trigger lead qualification with diagnostic insights
              triggerLeadQualificationWebhook({
                name: visitorName || 'Unknown',
                email: visitorEmail,
                message: `Diagnostic completed. ${diagnosticResponse.diagnosticData.diagnostic_summary || 'See diagnostic audit for details.'}`,
                submissionId: contactSubmissions[0].id.toString(),
                submittedAt: new Date().toISOString(),
                source: 'chat_diagnostic',
              }).catch(err => console.error('Lead qualification webhook failed:', err))
            }
          }

          // Trigger diagnostic completion webhook for sales enablement
          triggerDiagnosticCompletionWebhook(
            diagnosticAuditId,
            diagnosticResponse.diagnosticData as any,
            { email: visitorEmail, name: visitorName }
          ).catch(err => console.error('Diagnostic completion webhook failed:', err))
        }

        n8nResponse = {
          response: diagnosticResponse.response,
          escalated: false,
          metadata: diagnosticResponse.metadata || {},
        }
      } catch (error) {
        console.error('Diagnostic n8n error, trying regular workflow with diagnostic flags:', error)
        // Fall back to regular workflow but with diagnostic mode flags
        // This allows the workflow to detect diagnosticMode if it has the IF node configured
        try {
          n8nResponse = await sendToN8n({
            message: message.trim(),
            sessionId,
            visitorEmail,
            visitorName,
            diagnosticMode: true,
            diagnosticAuditId: diagnosticAuditId || undefined,
            diagnosticProgress: currentDiagnosticProgress || undefined,
          })
        } catch (fallbackError) {
          // If even the fallback fails, use regular chat as last resort
          console.error('Fallback also failed, using regular chat:', fallbackError)
          n8nResponse = await sendToN8n({
            message: message.trim(),
            sessionId,
            visitorEmail,
            visitorName,
            diagnosticMode: false,
          })
        }
      }
    } else {
      // Regular chat mode
      n8nResponse = await sendToN8n({
        message: message.trim(),
        sessionId,
        visitorEmail,
        visitorName,
        diagnosticMode: false,
      })
    }

    // Save assistant response to database
    const { error: assistantMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: n8nResponse.escalated ? 'support' : 'assistant',
        content: n8nResponse.response,
        metadata: {
          ...n8nResponse.metadata,
          diagnosticMode: isDiagnosticMode,
          diagnosticAuditId: diagnosticAuditId || undefined,
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
    }

    // Final safeguard - ensure response is always a string
    let finalResponse = n8nResponse.response
    if (typeof finalResponse === 'object' && finalResponse !== null) {
      // If response is an object, extract the text field or stringify
      finalResponse = finalResponse.response || finalResponse.text || finalResponse.message || JSON.stringify(finalResponse)
    } else if (typeof finalResponse === 'string') {
      // Try to parse if it's a JSON string
      try {
        const parsed = JSON.parse(finalResponse)
        if (parsed && typeof parsed === 'object' && parsed.response) {
          finalResponse = parsed.response
        }
      } catch {
        // Not JSON, use as-is
      }
    }

    return NextResponse.json({
      response: String(finalResponse || ''),
      sessionId,
      escalated: n8nResponse.escalated,
      metadata: n8nResponse.metadata,
      diagnosticMode: isDiagnosticMode,
      diagnosticAuditId: diagnosticAuditId || undefined,
      diagnosticProgress: currentDiagnosticProgress || undefined,
      currentCategory: currentCategory,
      diagnosticComplete: diagnosticComplete,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Return a friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it's an n8n configuration error
    if (errorMessage.includes('N8N_WEBHOOK_URL')) {
      return NextResponse.json(
        { 
          error: 'Chat service is not configured. Please try the contact form instead.',
          fallback: true 
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Unable to process your message. Please try again or use the contact form.',
        fallback: true
      },
      { status: 500 }
    )
  }
}
