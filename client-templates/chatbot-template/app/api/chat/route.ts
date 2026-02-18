import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToN8n, generateSessionId, type ChatMessage } from '@/lib/n8n'
import { fetchConversationContext } from '@/lib/chat-context'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      message, 
      sessionId: providedSessionId, 
      visitorEmail, 
      visitorName,
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

    // Save user message to database
    const { error: userMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message.trim(),
        metadata: { 
          source: 'text',
          channel: 'text',
          visitorEmail, 
          visitorName,
          timestamp: new Date().toISOString(),
        },
      })

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
    }

    // Track timing for latency measurement
    const requestStartTime = Date.now()

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

    // Send to n8n
    const n8nResponse = await sendToN8n({
      message: message.trim(),
      sessionId,
      visitorEmail,
      visitorName,
      source: 'text',
      history,
      conversationSummary: context?.summary,
      hasCrossChannelHistory,
    })

    // Calculate response latency
    const responseLatencyMs = Date.now() - requestStartTime

    // Save assistant response to database
    const { error: assistantMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: n8nResponse.escalated ? 'support' : 'assistant',
        content: n8nResponse.response,
        metadata: {
          source: 'text',
          channel: 'text',
          hasCrossChannelHistory,
          latency_ms: responseLatencyMs,
          timestamp: new Date().toISOString(),
          ...n8nResponse.metadata,
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
    }

    // Ensure response is always a string
    let finalResponse: string = n8nResponse.response
    const responseValue = n8nResponse.response as unknown
    if (typeof responseValue === 'object' && responseValue !== null) {
      const responseObj = responseValue as Record<string, unknown>
      finalResponse = String(responseObj.response || responseObj.text || responseObj.message || JSON.stringify(responseValue))
    }

    return NextResponse.json({
      response: String(finalResponse || ''),
      sessionId,
      escalated: n8nResponse.escalated,
      metadata: n8nResponse.metadata,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('N8N_WEBHOOK_URL')) {
      return NextResponse.json(
        { 
          error: 'Chat service is not configured. Please contact support.',
          fallback: true 
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Unable to process your message. Please try again.',
        fallback: true
      },
      { status: 500 }
    )
  }
}
