/**
 * Video ideas context — aggregates all sources for LLM-driven video idea generation.
 * Used by the generate-ideas API to build a rich context for script + storyboard generation.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { getCreatorBackgroundText } from '@/lib/constants/creator-background'
import { CHATBOT_KNOWLEDGE_BODY } from '@/lib/chatbot-knowledge-content.generated'

const MAX_TRANSCRIPT_CHARS = 3000
const MAX_CHAT_SESSION_CHARS = 2000
const MAX_KNOWLEDGE_CHARS = 8000
const DEFAULT_MEETINGS_LIMIT = 10
const DEFAULT_CHAT_SESSIONS_LIMIT = 5

export interface VideoIdeasContext {
  creatorBackground: string
  amaduTownContent: string
  meetings: Array<{
    id: string
    meeting_type: string
    meeting_date: string
    summary: string | null
    transcriptExcerpt: string | null
    key_decisions: unknown[] | null
  }>
  chatSessionsSample: Array<{
    session_id: string
    excerpt: string
    messageCount: number
  }>
  socialContentTopics: Array<{
    topic: string
    post_text: string
  }>
}

/**
 * Fetch full video ideas context for LLM prompt injection.
 */
export async function fetchVideoIdeasContext(opts?: {
  includeTranscripts?: boolean
  meetingsLimit?: number
  chatSessionsLimit?: number
}): Promise<VideoIdeasContext> {
  const includeTranscripts = opts?.includeTranscripts ?? true
  const meetingsLimit = opts?.meetingsLimit ?? DEFAULT_MEETINGS_LIMIT
  const chatSessionsLimit = opts?.chatSessionsLimit ?? DEFAULT_CHAT_SESSIONS_LIMIT

  const [meetings, chatSessions, socialTopics] = await Promise.all([
    fetchMeetingsForIdeas(meetingsLimit, includeTranscripts),
    fetchChatSessionsSample(chatSessionsLimit),
    fetchSocialContentTopics(5),
  ])

  const amaduTownContent =
    CHATBOT_KNOWLEDGE_BODY.length > MAX_KNOWLEDGE_CHARS
      ? CHATBOT_KNOWLEDGE_BODY.slice(0, MAX_KNOWLEDGE_CHARS) + '\n\n[...truncated]'
      : CHATBOT_KNOWLEDGE_BODY

  return {
    creatorBackground: getCreatorBackgroundText(),
    amaduTownContent,
    meetings,
    chatSessionsSample: chatSessions,
    socialContentTopics: socialTopics,
  }
}

async function fetchMeetingsForIdeas(
  limit: number,
  includeTranscripts: boolean
): Promise<VideoIdeasContext['meetings']> {
  const { data } = await supabaseAdmin
    .from('meeting_records')
    .select('id, meeting_type, meeting_date, structured_notes, transcript, key_decisions')
    .order('meeting_date', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  return data.map((m: { id: string; meeting_type: string; meeting_date: string; structured_notes: unknown; transcript: string | null; key_decisions: unknown }) => {
    const notes = m.structured_notes as Record<string, unknown> | null
    const summary =
      (notes?.summary as string) ?? (notes?.highlights as string) ?? null
    const transcriptExcerpt =
      includeTranscripts && m.transcript
        ? m.transcript.length > MAX_TRANSCRIPT_CHARS
          ? m.transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '...'
          : m.transcript
        : null

    return {
      id: m.id,
      meeting_type: m.meeting_type,
      meeting_date: m.meeting_date,
      summary,
      transcriptExcerpt,
      key_decisions: m.key_decisions as unknown[] | null,
    }
  })
}

async function fetchChatSessionsSample(
  limit: number
): Promise<VideoIdeasContext['chatSessionsSample']> {
  const { data: sessions } = await supabaseAdmin
    .from('chat_sessions')
    .select('session_id')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!sessions || sessions.length === 0) return []

  const sessionIds = sessions.map((s: { session_id: string }) => s.session_id)

  const { data: messages } = await supabaseAdmin
    .from('chat_messages')
    .select('session_id, role, content, created_at')
    .in('session_id', sessionIds)
    .order('created_at', { ascending: true })

  if (!messages || messages.length === 0) return []

  const bySession = new Map<string, Array<{ role: string; content: string }>>()
  for (const m of messages) {
    if (!bySession.has(m.session_id)) {
      bySession.set(m.session_id, [])
    }
    bySession.get(m.session_id)!.push({ role: m.role, content: m.content })
  }

  return Array.from(bySession.entries()).map(([session_id, msgs]) => {
    const formatted = msgs
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')
    const excerpt =
      formatted.length > MAX_CHAT_SESSION_CHARS
        ? formatted.slice(0, MAX_CHAT_SESSION_CHARS) + '...'
        : formatted
    return {
      session_id,
      excerpt,
      messageCount: msgs.length,
    }
  })
}

async function fetchSocialContentTopics(
  limit: number
): Promise<VideoIdeasContext['socialContentTopics']> {
  const { data } = await supabaseAdmin
    .from('social_content_queue')
    .select('topic_extracted, post_text')
    .in('status', ['draft', 'approved', 'published'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (!data || data.length === 0) return []

  type Row = { topic_extracted: unknown; post_text: string | null }
  return data
    .filter((r: Row) => r.post_text)
    .map((r: Row) => {
      const topic =
        (r.topic_extracted as Record<string, unknown>)?.topic as string | undefined
      return {
        topic: topic ?? 'General insight',
        post_text: (r.post_text ?? '').slice(0, 500),
      }
    })
}

/**
 * Serialize context for LLM prompt.
 */
export function serializeContextForPrompt(ctx: VideoIdeasContext): string {
  const parts: string[] = []

  parts.push('## Creator Background\n' + ctx.creatorBackground)
  parts.push('\n## AmaduTown Website Content\n' + ctx.amaduTownContent)

  if (ctx.meetings.length > 0) {
    parts.push('\n## Recent Meeting Insights')
    for (const m of ctx.meetings) {
      parts.push(
        `\n### ${m.meeting_type} (${m.meeting_date})\nSummary: ${m.summary ?? 'N/A'}`
      )
      if (m.transcriptExcerpt) {
        parts.push(`Transcript excerpt:\n${m.transcriptExcerpt}`)
      }
      if (m.key_decisions && m.key_decisions.length > 0) {
        parts.push(
          `Key decisions: ${JSON.stringify(m.key_decisions).slice(0, 500)}`
        )
      }
    }
  }

  if (ctx.chatSessionsSample.length > 0) {
    parts.push('\n## Sample Chat Conversations (site visitors)')
    for (const s of ctx.chatSessionsSample) {
      parts.push(`\nSession (${s.messageCount} messages):\n${s.excerpt}`)
    }
  }

  if (ctx.socialContentTopics.length > 0) {
    parts.push('\n## Recent Social Content Topics (from meetings)')
    for (const t of ctx.socialContentTopics) {
      parts.push(`\nTopic: ${t.topic}\nPost: ${t.post_text}`)
    }
  }

  return parts.join('\n')
}
