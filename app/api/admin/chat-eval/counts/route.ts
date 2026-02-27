import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

/** Derive which channels a session has (from message metadata). Same logic as list API.
 * - voice: website voice component
 * - chatbot: website chat component (or legacy source 'text' / no source)
 * - text: reserved for future SMS channel (only source === 'sms')
 * - email: email channel
 */
function getSessionChannels(messages: Array<{ metadata?: { source?: string; channel?: string } }>): Set<string> {
  const channels = new Set<string>()
  for (const msg of messages || []) {
    const source = msg.metadata?.source || msg.metadata?.channel
    if (source === 'voice') channels.add('voice')
    if (source === 'chatbot' || source === 'text' || !source) channels.add('chatbot')
    if (source === 'sms') channels.add('text') // reserved for future SMS channel
    if (source === 'email') channels.add('email')
  }
  return channels
}

/**
 * GET /api/admin/chat-eval/counts
 * Returns session counts per filter option (channel, annotated/unannotated, good/bad)
 * so the filter sidebar can show counts without the user clicking each filter.
 */
export async function GET(request: NextRequest) {
  const authResult = await verifyAdmin(request)
  if (isAuthError(authResult)) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    )
  }

  try {
    const { data: sessions, error } = await supabaseAdmin
      .from('chat_sessions')
      .select(`
        id,
        chat_messages(metadata),
        chat_evaluations(rating)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching sessions for counts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch counts' },
        { status: 500 }
      )
    }

    const channelCounts = { voice: 0, text: 0, email: 0, chatbot: 0 }
    let annotated = 0
    let unannotated = 0
    let good = 0
    let bad = 0

    for (const session of sessions || []) {
      const messages = (session as any).chat_messages || []
      const evaluation = (session as any).chat_evaluations?.[0]
      const rating = evaluation?.rating
      const channels = getSessionChannels(messages)

      if (channels.has('voice')) channelCounts.voice++
      if (channels.has('text')) channelCounts.text++
      if (channels.has('email')) channelCounts.email++
      if (channels.has('chatbot')) channelCounts.chatbot++

      if (rating) {
        annotated++
        if (rating === 'good') good++
        if (rating === 'bad') bad++
      } else {
        unannotated++
      }
    }

    return NextResponse.json({
      channel: channelCounts,
      annotated,
      unannotated,
      good,
      bad,
    })
  } catch (err) {
    console.error('Chat eval counts error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
