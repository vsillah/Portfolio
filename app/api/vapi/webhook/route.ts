import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToN8n, type ChatMessage } from '@/lib/n8n'
import { 
  VapiWebhookPayload, 
  createFunctionResponse, 
  createErrorResponse,
  extractSessionId,
} from '@/lib/vapi'
import { fetchConversationContext } from '@/lib/chat-context'

export const dynamic = 'force-dynamic'

/**
 * VAPI Webhook Handler
 * 
 * Receives events from VAPI voice calls and routes them appropriately:
 * - Transcripts -> N8N for AI processing
 * - Function calls -> Custom handlers or N8N
 * - Status updates -> Database logging
 */
export async function POST(request: NextRequest) {
  try {
    const payload: VapiWebhookPayload = await request.json()
    const { message } = payload

    console.log('[VAPI Webhook] Received:', message.type)

    switch (message.type) {
      case 'status-update':
        return handleStatusUpdate(message)
      
      case 'transcript':
        return handleTranscript(message)
      
      case 'function-call':
        return handleFunctionCall(message)
      
      case 'end-of-call-report':
        return handleEndOfCallReport(message)
      
      default:
        // Acknowledge unknown message types
        return NextResponse.json({ received: true })
    }
  } catch (error) {
    console.error('[VAPI Webhook] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Handle call status updates
 */
async function handleStatusUpdate(message: VapiWebhookPayload['message']) {
  const call = message.call
  if (!call) {
    return NextResponse.json({ received: true })
  }

  console.log(`[VAPI] Call ${call.id}: ${call.status}`)

  // Log call status to database
  try {
    const sessionId = extractSessionId(call.id, call.metadata)
    
    // Check if session exists
    const { data: existingSession } = await supabaseAdmin
      .from('chat_sessions')
      .select('id')
      .eq('session_id', sessionId)
      .single()

    if (!existingSession && call.status === 'in-progress') {
      // Create new session for voice call
      await supabaseAdmin
        .from('chat_sessions')
        .insert({
          session_id: sessionId,
          visitor_name: call.customer?.name || null,
          metadata: {
            source: 'voice',
            vapiCallId: call.id,
            startedAt: new Date().toISOString(),
          },
        })
    } else if (existingSession && call.status === 'ended') {
      // Update session with end time
      await supabaseAdmin
        .from('chat_sessions')
        .update({
          metadata: supabaseAdmin.rpc('jsonb_set', {
            target: 'metadata',
            path: '{endedAt}',
            value: JSON.stringify(new Date().toISOString()),
          }),
        })
        .eq('session_id', sessionId)
    }
  } catch (error) {
    console.error('[VAPI] Error logging status:', error)
  }

  return NextResponse.json({ received: true })
}

/**
 * Handle transcripts - route to N8N for AI processing
 */
async function handleTranscript(message: VapiWebhookPayload['message']) {
  const { role, transcript, transcriptType, call } = message

  // Only process final transcripts from the user
  if (transcriptType !== 'final' || role !== 'user' || !transcript) {
    return NextResponse.json({ received: true })
  }

  const callId = call?.id || 'unknown'
  const sessionId = extractSessionId(callId, call?.metadata)

  console.log(`[VAPI] Processing transcript: "${transcript.substring(0, 50)}..."`)

  try {
    // Save user message to database
    await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: transcript,
        metadata: {
          source: 'voice',
          vapiCallId: callId,
          transcriptType,
        },
      })

    // Fetch conversation history for context injection
    const context = await fetchConversationContext(sessionId, 20)
    
    // Format history for N8N
    const history: ChatMessage[] = context?.history.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      source: msg.source,
    })) || []

    // Detect if this is a cross-channel conversation
    const hasCrossChannelHistory = context?.sessionInfo.hasTextMessages && context?.sessionInfo.hasVoiceMessages

    console.log(`[VAPI] Session ${sessionId} has ${history.length} messages, cross-channel: ${hasCrossChannelHistory}`)

    // Send to N8N for AI processing with full context
    const n8nResponse = await sendToN8n({
      message: transcript,
      sessionId,
      visitorName: call?.customer?.name || context?.sessionInfo.visitorName,
      visitorEmail: context?.sessionInfo.visitorEmail,
      source: 'voice',
      history,
      conversationSummary: context?.summary,
      hasCrossChannelHistory,
    })

    // Save assistant response to database
    await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: n8nResponse.response,
        metadata: {
          source: 'voice',
          vapiCallId: callId,
          hasCrossChannelHistory,
          ...n8nResponse.metadata,
        },
      })

    // Return response for VAPI to speak
    return NextResponse.json({
      response: n8nResponse.response,
    })
  } catch (error) {
    console.error('[VAPI] Error processing transcript:', error)
    return NextResponse.json({
      response: "I apologize, but I'm having trouble processing that. Could you please try again?",
    })
  }
}

/**
 * Handle function calls from VAPI
 * These are tools the voice assistant can invoke
 */
async function handleFunctionCall(message: VapiWebhookPayload['message']) {
  const { functionCall, call } = message
  
  if (!functionCall) {
    return NextResponse.json(createErrorResponse('No function call data'))
  }

  const { name, parameters } = functionCall
  const callId = call?.id || 'unknown'
  const sessionId = extractSessionId(callId, call?.metadata)

  console.log(`[VAPI] Function call: ${name}`, parameters)

  try {
    switch (name) {
      case 'startDiagnostic':
        // Start a diagnostic audit
        return NextResponse.json(createFunctionResponse({
          message: "I'll start the diagnostic assessment now. Let me begin by understanding your current business challenges.",
          diagnosticStarted: true,
        }))

      case 'getProjectInfo':
        // Return info about projects
        const projectName = parameters.projectName as string
        return NextResponse.json(createFunctionResponse({
          message: `Let me tell you about ${projectName || 'my projects'}.`,
          // In a real implementation, you'd fetch project data here
        }))

      case 'scheduleCallback':
        // Schedule a callback
        const preferredTime = parameters.preferredTime as string
        return NextResponse.json(createFunctionResponse({
          message: `I've noted your preference for ${preferredTime}. Someone will reach out to confirm.`,
          scheduled: true,
        }))

      case 'transferToHuman':
        // Escalate to human support
        await supabaseAdmin
          .from('chat_sessions')
          .update({ is_escalated: true })
          .eq('session_id', sessionId)
        
        return NextResponse.json(createFunctionResponse({
          message: "I'll connect you with a human team member. They'll be in touch shortly.",
          escalated: true,
        }))

      case 'sendToN8n':
        // Generic function to send custom data to N8N
        const n8nResponse = await sendToN8n({
          message: JSON.stringify(parameters),
          sessionId,
        })
        return NextResponse.json(createFunctionResponse({
          response: n8nResponse.response,
        }))

      default:
        console.warn(`[VAPI] Unknown function: ${name}`)
        return NextResponse.json(createErrorResponse(`Unknown function: ${name}`))
    }
  } catch (error) {
    console.error(`[VAPI] Error in function ${name}:`, error)
    return NextResponse.json(createErrorResponse('Function execution failed'))
  }
}

/**
 * Handle end of call report
 */
async function handleEndOfCallReport(message: VapiWebhookPayload['message']) {
  const call = message.call
  if (!call) {
    return NextResponse.json({ received: true })
  }

  const sessionId = extractSessionId(call.id, call.metadata)

  console.log(`[VAPI] End of call report for ${call.id}`)

  try {
    // Update session with call summary
    await supabaseAdmin
      .from('chat_sessions')
      .update({
        metadata: {
          source: 'voice',
          vapiCallId: call.id,
          endedAt: new Date().toISOString(),
          endedReason: message.endedReason,
          summary: message.summary,
          transcript: message.transcript,
          recordingUrl: message.recordingUrl,
        },
      })
      .eq('session_id', sessionId)
  } catch (error) {
    console.error('[VAPI] Error saving call report:', error)
  }

  return NextResponse.json({ received: true })
}
