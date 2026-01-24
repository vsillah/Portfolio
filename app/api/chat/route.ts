import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendToN8n, generateSessionId } from '@/lib/n8n'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, sessionId: providedSessionId, visitorEmail, visitorName } = body

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

    // Save user message to database
    const { error: userMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message.trim(),
        metadata: { visitorEmail, visitorName },
      })

    if (userMsgError) {
      console.error('Error saving user message:', userMsgError)
    }

    // Send to n8n chat trigger
    // Note: n8n's Simple Memory handles conversation history using sessionId
    const n8nResponse = await sendToN8n({
      message: message.trim(),
      sessionId,
      visitorEmail,
      visitorName,
    })

    // Save assistant response to database
    const { error: assistantMsgError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        role: n8nResponse.escalated ? 'support' : 'assistant',
        content: n8nResponse.response,
        metadata: n8nResponse.metadata,
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

    return NextResponse.json({
      response: n8nResponse.response,
      sessionId,
      escalated: n8nResponse.escalated,
      metadata: n8nResponse.metadata,
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
