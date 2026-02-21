import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyMeetingBooked, notifyChatTranscript } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, templateType, data, sessionId } = body

    if (!to || !templateType) {
      return NextResponse.json(
        { error: 'Missing required fields: to, templateType' },
        { status: 400 }
      )
    }

    // Require sessionId — prevents unauthenticated email relay
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    const { data: session } = await supabaseAdmin
      .from('chat_sessions')
      .select('id, visitor_email, user_id')
      .eq('session_id', sessionId)
      .single()

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      )
    }

    // Validate to matches session's visitor_email or linked user's email
    const toLower = String(to).toLowerCase()
    let allowedEmails: string[] = []
    if (session.visitor_email) {
      allowedEmails.push(session.visitor_email.toLowerCase())
    }
    if (session.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .eq('id', session.user_id)
        .single()
      if (profile?.email) {
        allowedEmails.push(profile.email.toLowerCase())
      }
    }
    if (allowedEmails.length > 0 && !allowedEmails.includes(toLower)) {
      return NextResponse.json(
        { error: 'Email does not match session' },
        { status: 403 }
      )
    }

    switch (templateType) {
      case 'meeting_confirmation': {
        await notifyMeetingBooked({
          clientEmail: to,
          clientName: data?.name || 'there',
          meetingType: data?.meetingType,
          meetingDate: data?.meetingDate,
          meetingTime: data?.meetingTime,
          calendlyLink: data?.calendlyLink,
        })
        break
      }

      case 'chat_summary': {
        if (!data?.transcript) {
          return NextResponse.json(
            { error: 'Transcript is required for chat_summary' },
            { status: 400 }
          )
        }
        await notifyChatTranscript({
          clientEmail: to,
          clientName: data?.name || 'there',
          transcript: data.transcript,
          sessionDate: data?.sessionDate || new Date().toLocaleDateString(),
        })
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown template type: ${templateType}` },
          { status: 400 }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Send email API error:', error)
    return NextResponse.json(
      { error: 'Failed to send email. Please try again.' },
      { status: 500 }
    )
  }
}
