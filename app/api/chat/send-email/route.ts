import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { notifyMeetingBooked, notifyChatTranscript } from '@/lib/notifications'
import { sendEmailSchema, zodErrorResponse } from '@/lib/chat-validation'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = sendEmailSchema.parse(body)
    const { to, templateType, sessionId } = parsed
    const data = parsed.data as Record<string, string | undefined> | undefined

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
    if (error instanceof ZodError) {
      const { error: msg, detail, status } = zodErrorResponse(error)
      return NextResponse.json({ error: msg, detail }, { status })
    }
    console.error('Send email API error:', error)
    return NextResponse.json(
      { error: 'Failed to send email. Please try again.' },
      { status: 500 }
    )
  }
}
