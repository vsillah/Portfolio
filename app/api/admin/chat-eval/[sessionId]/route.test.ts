import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyAdmin: vi.fn(),
  isAuthError: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  verifyAdmin: mocks.verifyAdmin,
  isAuthError: mocks.isAuthError,
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: mocks.from,
    rpc: mocks.rpc,
  },
}))

import { DELETE, GET, PUT } from './route'

const params = { params: { sessionId: 'sess-1' } }

function request(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/admin/chat-eval/sess-1', {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('chat-eval session detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.verifyAdmin.mockResolvedValue({ user: { id: 'admin-1' } })
    mocks.isAuthError.mockImplementation(
      (result: { error?: string } | null) => Boolean(result) && typeof result === 'object' && 'error' in result
    )
    mocks.rpc.mockResolvedValue({ data: null, error: null })
  })

  describe('GET', () => {
    it('rejects non-admins before loading the session', async () => {
      mocks.verifyAdmin.mockResolvedValue({ error: 'Unauthorized', status: 401 })

      const response = await GET(request('GET'), params)

      expect(response.status).toBe(401)
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the session is missing', async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: '0 rows' } })
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })),
      })

      const response = await GET(request('GET'), params)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Session not found' })
      expect(mocks.from).toHaveBeenCalledTimes(1)
    })

    it('sorts messages, averages numeric latency, and prefers voice over other sources', async () => {
      const evaluation = {
        id: 'eval-1',
        rating: 'bad',
        notes: 'Missed the question',
        evaluation_categories: { id: 'cat-1', name: 'Accuracy', color: '#f00' },
      }
      const sessionSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'row-1',
          session_id: 'sess-1',
          visitor_name: 'Ada',
          visitor_email: 'ada@example.com',
          is_escalated: true,
          created_at: '2026-09-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:10:00.000Z',
          metadata: {
            vapiCallId: 'call-1',
            recordingUrl: 'https://example.com/rec',
            durationSeconds: 90,
            startedAt: '2026-09-01T00:00:00.000Z',
            endedAt: '2026-09-01T00:01:30.000Z',
            endedReason: 'assistant-ended',
            summary: 'Billing call',
            transcript: 'full text',
          },
          chat_evaluations: [evaluation],
          chat_messages: [
            {
              id: 'm2',
              role: 'assistant',
              content: 'Answer',
              created_at: '2026-09-01T00:01:00.000Z',
              metadata: {
                source: 'voice',
                latency_ms: 20,
                isToolCall: true,
                toolCall: { name: 'lookup' },
                extra: 'drop-me',
              },
            },
            {
              id: 'm1',
              role: 'user',
              content: 'Question',
              created_at: '2026-09-01T00:00:00.000Z',
              metadata: { channel: 'email', latency_ms: '12', diagnosticMode: true },
            },
            {
              id: 'm3',
              role: 'assistant',
              content: 'Follow up',
              created_at: '2026-09-01T00:02:00.000Z',
              metadata: { latency_ms: 10.2 },
            },
          ],
        },
        error: null,
      })
      const llmOrder = vi.fn().mockResolvedValue({ data: [{ id: 'judge-1', human_alignment: true }], error: null })
      mocks.from.mockImplementation((table: string) => {
        if (table === 'chat_sessions') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: sessionSingle })) })) }
        }
        if (table === 'llm_judge_evaluations') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: llmOrder })) })) }
        }
        throw new Error(table)
      })

      const response = await GET(request('GET'), params)
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.channel).toBe('voice')
      expect(body.messages.map((message: { id: string; metadata: { source?: string } }) => [message.id, message.metadata.source])).toEqual([
        ['m1', 'email'],
        ['m2', 'voice'],
        ['m3', undefined],
      ])
      expect(body.messages[1].metadata).toEqual({
        source: 'voice',
        latency_ms: 20,
        isToolCall: true,
        toolCall: { name: 'lookup' },
      })
      expect(body.tool_calls).toEqual([
        { message_id: 'm2', timestamp: '2026-09-01T00:01:00.000Z', name: 'lookup' },
      ])
      expect(body.metrics).toEqual({
        message_count: 3,
        user_message_count: 1,
        assistant_message_count: 2,
        tool_call_count: 1,
        avg_latency_ms: 15,
        has_escalation: true,
      })
      expect(body.voice_data).toEqual({
        vapi_call_id: 'call-1',
        recording_url: 'https://example.com/rec',
        duration_seconds: 90,
        started_at: '2026-09-01T00:00:00.000Z',
        ended_at: '2026-09-01T00:01:30.000Z',
        ended_reason: 'assistant-ended',
        summary: 'Billing call',
        full_transcript: 'full text',
      })
      expect(body.evaluation).toEqual(evaluation)
      expect(body.llm_evaluations).toEqual([{ id: 'judge-1', human_alignment: true }])
      expect(llmOrder).toHaveBeenCalledWith('evaluated_at', { ascending: false })
    })

    it('leaves voice data empty for a non-voice session and ignores non-numeric latency', async () => {
      const sessionSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'row-2',
          session_id: 'sess-1',
          is_escalated: false,
          metadata: { recordingUrl: 'https://example.com/ignored' },
          chat_evaluations: [],
          chat_messages: [
            {
              id: 'm1',
              role: 'assistant',
              content: 'Hi',
              created_at: '2026-09-01T00:00:00.000Z',
              metadata: { source: 'chatbot', latency_ms: 'slow' },
            },
          ],
        },
        error: null,
      })
      mocks.from.mockImplementation((table: string) => {
        if (table === 'llm_judge_evaluations') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: null, error: null }) })) })) }
        }
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: sessionSingle })) })) }
      })

      const response = await GET(request('GET'), params)
      const body = await response.json()

      expect(body.channel).toBe('chatbot')
      expect(body.voice_data).toBeNull()
      expect(body.metrics.avg_latency_ms).toBeNull()
      expect(body.evaluation).toBeNull()
      expect(body.llm_evaluations).toEqual([])
    })
  })

  describe('PUT', () => {
    it('rejects ratings outside good and bad before looking up the session', async () => {
      const response = await PUT(request('PUT', { rating: 'Good' }), params)

      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Rating must be "good" or "bad"' })
      expect(mocks.from).not.toHaveBeenCalled()
    })

    it('returns 404 when the session does not exist', async () => {
      mocks.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'missing' } }) })),
        })),
      })

      const response = await PUT(request('PUT', { rating: 'bad' }), params)

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'Session not found' })
    })

    it('upserts the evaluation and records a new open code', async () => {
      const sessionSingle = vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null })
      const evalSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'eval-1',
          rating: 'bad',
          evaluation_categories: { name: 'Accuracy', color: '#f00' },
        },
        error: null,
      })
      const upsert = vi.fn(() => ({ select: vi.fn(() => ({ single: evalSingle })) }))
      const openCodeUpsert = vi.fn().mockResolvedValue({ data: null, error: null })
      mocks.from.mockImplementation((table: string) => {
        if (table === 'chat_sessions') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: sessionSingle })) })) }
        }
        if (table === 'chat_evaluations') return { upsert }
        if (table === 'open_codes') return { upsert: openCodeUpsert }
        throw new Error(table)
      })

      const response = await PUT(
        request('PUT', { rating: 'bad', notes: 'Missed it', open_code: 'wrong-tool', tags: ['billing'] }),
        params
      )

      expect(response.status).toBe(200)
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'sess-1',
          message_id: null,
          rating: 'bad',
          notes: 'Missed it',
          tags: ['billing'],
          category_id: null,
          open_code: 'wrong-tool',
          evaluated_by: 'admin-1',
          evaluated_at: expect.any(String),
        }),
        { onConflict: 'session_id,message_id' }
      )
      expect(openCodeUpsert).toHaveBeenCalledWith(
        { code: 'wrong-tool', created_by: 'admin-1' },
        { onConflict: 'code' }
      )
      expect(mocks.rpc).toHaveBeenCalledWith('increment_open_code_usage', { code_text: 'wrong-tool' })
      expect(await response.json()).toEqual({
        success: true,
        evaluation: {
          id: 'eval-1',
          rating: 'bad',
          evaluation_categories: { name: 'Accuracy', color: '#f00' },
          category_name: 'Accuracy',
          category_color: '#f00',
        },
      })
    })

    it('still saves the evaluation when open-code tracking fails', async () => {
      const evalSingle = vi.fn().mockResolvedValue({
        data: { id: 'eval-1', rating: 'good', evaluation_categories: null },
        error: null,
      })
      const openCodeUpsert = vi.fn().mockRejectedValue(new Error('open code down'))
      mocks.from.mockImplementation((table: string) => {
        if (table === 'chat_sessions') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null }) })) })) }
        }
        if (table === 'chat_evaluations') {
          return { upsert: vi.fn(() => ({ select: vi.fn(() => ({ single: evalSingle })) })) }
        }
        return { upsert: openCodeUpsert }
      })

      const response = await PUT(request('PUT', { open_code: 'new-code' }), params)

      expect(response.status).toBe(200)
      expect(mocks.rpc).not.toHaveBeenCalled()
      expect((await response.json()).success).toBe(true)
    })

    it('returns a generic error when the evaluation upsert fails', async () => {
      mocks.from.mockImplementation((table: string) => {
        if (table === 'chat_sessions') {
          return { select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null }) })) })) }
        }
        return {
          upsert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'conflict' } }),
            })),
          })),
        }
      })

      const response = await PUT(request('PUT', { rating: 'good', open_code: 'should-not-track' }), params)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to save evaluation' })
      expect(mocks.from).not.toHaveBeenCalledWith('open_codes')
    })
  })

  describe('DELETE', () => {
    it('requires a session id and deletes by session_id', async () => {
      const missing = await DELETE(request('DELETE'), { params: { sessionId: '' } })
      expect(missing.status).toBe(400)
      expect(await missing.json()).toEqual({ error: 'Session ID required' })
      expect(mocks.from).not.toHaveBeenCalled()

      const eq = vi.fn().mockResolvedValue({ error: null })
      const remove = vi.fn(() => ({ eq }))
      mocks.from.mockReturnValue({ delete: remove })

      const response = await DELETE(request('DELETE'), params)

      expect(remove).toHaveBeenCalled()
      expect(eq).toHaveBeenCalledWith('session_id', 'sess-1')
      expect(await response.json()).toEqual({ success: true })
    })

    it('returns a generic error when the delete fails', async () => {
      mocks.from.mockReturnValue({
        delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: { message: 'fk violation' } }) })),
      })

      const response = await DELETE(request('DELETE'), params)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Failed to delete session' })
    })
  })
})
