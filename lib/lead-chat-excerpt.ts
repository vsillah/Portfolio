/**
 * Optional prompt-only context: recent site chat (Supabase) for the same email as a lead.
 * See docs/email-rag-knowledge-and-chat-policy.md. Not embedded in Pinecone.
 */

import { supabaseAdmin } from '@/lib/supabase'

const MAX_TOTAL_CHARS = 4_000
const MAX_MESSAGES = 16

/**
 * When EMAIL_RAG_INCLUDE_SITE_CHAT is "true" and the lead email matches
 * chat_sessions.visitor_email, return a compact transcript for the most recent session.
 */
export async function fetchRecentSiteChatExcerptForLeadEmail(
  email: string | null | undefined
): Promise<string | null> {
  if (process.env.EMAIL_RAG_INCLUDE_SITE_CHAT !== 'true') {
    return null
  }
  if (!email?.trim() || !supabaseAdmin) return null

  const normalized = email.trim().toLowerCase()

  const { data: session, error: sErr } = await supabaseAdmin
    .from('chat_sessions')
    .select('session_id, updated_at')
    .ilike('visitor_email', normalized)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sErr || !session?.session_id) return null

  const { data: messages, error: mErr } = await supabaseAdmin
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', session.session_id)
    .order('created_at', { ascending: true })
    .limit(MAX_MESSAGES)

  if (mErr || !messages?.length) return null

  const lines: string[] = []
  let total = 0
  for (const m of messages) {
    const role = m.role === 'user' ? 'Visitor' : m.role === 'assistant' ? 'Assistant' : m.role
    const line = `[${role}]: ${(m.content || '').trim()}`
    if (total + line.length > MAX_TOTAL_CHARS) break
    lines.push(line)
    total += line.length + 1
  }

  if (lines.length === 0) return null
  return lines.join('\n\n')
}
