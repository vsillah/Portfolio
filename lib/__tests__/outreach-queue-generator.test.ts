import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGetSystemPrompt = vi.fn()
const mockLoadLeadResearchBrief = vi.fn()
const mockRecordOpenAICost = vi.fn()
const mockRecordAnthropicCost = vi.fn()

/** When set, duplicate-check returns this draft id (skip path). */
let mockExistingDraftId: string | null = null
let mockInsertId = '00000000-0000-4000-8000-000000000001'
/** Captures the payload passed to outreach_queue.insert() (Phase 2 traceability tests). */
let lastOutreachInsertPayload: Record<string, unknown> | null = null
/** Phase 3 — rows the prior-outreach loader sees on outreach_queue. */
let mockPriorOutreachRows: Array<Record<string, unknown>> = []
/** Phase 3 — rows the prior-outreach loader sees on contact_communications. */
let mockPriorInboundCommsRows: Array<Record<string, unknown>> = []

vi.mock('@/lib/system-prompts', () => ({
  getSystemPrompt: (...args: unknown[]) => mockGetSystemPrompt(...args),
}))

vi.mock('@/lib/lead-research-context', () => ({
  loadLeadResearchBrief: (...args: unknown[]) => mockLoadLeadResearchBrief(...args),
}))

vi.mock('@/lib/cost-calculator', () => ({
  recordOpenAICost: (...args: unknown[]) => mockRecordOpenAICost(...args),
  recordAnthropicCost: (...args: unknown[]) => mockRecordAnthropicCost(...args),
}))

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === 'contact_submissions') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: 99,
                    do_not_contact: false,
                    removed_at: null,
                    is_test_data: false,
                  },
                  error: null,
                }),
            }),
          }),
        }
      }
      if (table === 'meeting_records') {
        return {
          select: () => ({
            eq: (col: string) => {
              if (col === 'contact_submission_id') {
                return {
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({ data: null, error: null }),
                    }),
                  }),
                }
              }
              return {
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { id: 'm1' }, error: null }),
                }),
                maybeSingle: () =>
                  Promise.resolve({ data: { id: 'm1' }, error: null }),
              }
            },
          }),
        }
      }
      if (table === 'value_evidence_summary') {
        const empty = () => Promise.resolve({ data: [] as unknown[], error: null })
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: empty,
              }),
            }),
            is: () => ({
              order: () => ({
                limit: empty,
              }),
            }),
          }),
        }
      }
      if (table === 'meeting_action_tasks') {
        // Stub for lib/meeting-tasks-context.loadOpenOutreachTasksForContact:
        //   .select(...).eq(contact_submission_id, ...).eq(task_category, 'outreach')
        //   .in('status', [...]).order(due_date).order(created_at).limit(...)
        type EmptyResult = Promise<{ data: never[]; error: null }>
        type OrderChain = { order: () => OrderChain; limit: () => EmptyResult }
        const emptyResult = (): EmptyResult => Promise.resolve({ data: [], error: null })
        const orderChain: () => OrderChain = () => ({
          order: orderChain,
          limit: emptyResult,
        })
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => orderChain(),
              }),
            }),
          }),
        }
      }
      if (table === 'outreach_queue') {
        // Duplicate-check chain (before LLM call):
        //   .select().eq(contact_submission_id).eq(channel).eq(sequence_step)
        //     .eq(status)
        //     [.is(source_task_id, null) | .eq(source_task_id, ...)]
        //     .limit(1).maybeSingle()
        const dupMaybeSingle = () =>
          Promise.resolve({
            data: mockExistingDraftId ? { id: mockExistingDraftId } : null,
            error: null,
          })
        const dupLimit = () => ({ maybeSingle: dupMaybeSingle })
        /** After .is(source_task, null).contains(...).is(context) | .eq(context) */
        const dupSourceTaskFilter = () => ({
          contains: () => ({
            is: () => ({ limit: dupLimit }),
            eq: () => ({ limit: dupLimit }),
          }),
        })

        // Phase 3 prior-outreach loader chain:
        //   .select().eq(contact_submission_id).in('status', [...]).order(...).limit(...)
        const priorLimit = () =>
          Promise.resolve({ data: mockPriorOutreachRows, error: null })
        const priorOrder = () => ({ limit: priorLimit })
        const priorIn = () => ({ order: priorOrder })

        return {
          select: () => ({
            eq: () => ({
              in: priorIn,
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    is: dupSourceTaskFilter,
                    // Task idempotency: 5th eq (source_task_id) then limit
                    eq: () => ({ limit: dupLimit }),
                    limit: dupLimit,
                  }),
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            lastOutreachInsertPayload = payload
            return {
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: mockInsertId },
                    error: null,
                  }),
              }),
            }
          },
        }
      }
      if (table === 'contact_communications') {
        // Phase 3 prior-outreach loader chain:
        //   .select().eq(contact_submission_id).eq(direction, 'inbound')
        //     .order(created_at, ...).limit(N)
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({
                      data: mockPriorInboundCommsRows,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        }
      }
      return {}
    }),
  },
}))

describe('outreach-queue-generator helpers', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  it('capMeetingSummary leaves short text unchanged', async () => {
    const { capMeetingSummary } = await import('../outreach-queue-generator')
    expect(capMeetingSummary('  hello  ')).toBe('hello')
  })

  it('capMeetingSummary truncates beyond MEETING_SUMMARY_MAX_CHARS', async () => {
    const { capMeetingSummary, MEETING_SUMMARY_MAX_CHARS } = await import('../outreach-queue-generator')
    const long = 'x'.repeat(MEETING_SUMMARY_MAX_CHARS + 50)
    const out = capMeetingSummary(long)
    expect(out.length).toBeLessThanOrEqual(MEETING_SUMMARY_MAX_CHARS + 20)
    expect(out).toContain('truncated')
  })

  it('isInAppOutreachGenerationEnabled is false when ENABLE_IN_APP_OUTREACH_GEN=false', async () => {
    process.env.ENABLE_IN_APP_OUTREACH_GEN = 'false'
    const { isInAppOutreachGenerationEnabled } = await import('../outreach-queue-generator')
    expect(isInAppOutreachGenerationEnabled()).toBe(false)
  })
})

describe('generateOutreachDraftInApp', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.resetModules()
    mockExistingDraftId = null
    mockInsertId = '00000000-0000-4000-8000-000000000001'
    lastOutreachInsertPayload = null
    mockPriorOutreachRows = []
    mockPriorInboundCommsRows = []
    mockGetSystemPrompt.mockResolvedValue({
      prompt: 'Brief:\n{{research_brief}}\nProof:\n{{social_proof}}\nFrom {{sender_name}}',
      config: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 600 },
      version: 7,
    })
    mockLoadLeadResearchBrief.mockResolvedValue({
      contact: {
        name: 'Test Lead',
        email: 't@example.com',
        company: 'Acme',
        industry: 'saas',
        job_title: null,
        employee_count: null,
        annual_revenue: null,
        location: null,
        interest_areas: null,
        interest_summary: null,
        rep_pain_points: null,
        quick_wins: null,
        ai_readiness_score: null,
        competitive_pressure_score: null,
        potential_recommendations_summary: null,
        website_tech_stack: null,
      },
      researchBrief: 'Research here',
      socialProof: 'Proof here',
    })
    mockRecordOpenAICost.mockResolvedValue(undefined)

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({ subject: 'Hello', body: 'Body text for outreach.' }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.ENABLE_IN_APP_OUTREACH_GEN = 'true'
    process.env.EMAIL_RAG_ENABLED = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
    mockGetSystemPrompt.mockReset()
    mockLoadLeadResearchBrief.mockReset()
    mockRecordOpenAICost.mockReset()
  })

  it('returns created with id after OpenAI and insert', async () => {
    const { generateOutreachDraftInApp } = await import('../outreach-queue-generator')
    const result = await generateOutreachDraftInApp({ contactId: 99, force: false })

    expect(result.outcome).toBe('created')
    if (result.outcome === 'created') {
      expect(result.id).toBe(mockInsertId)
      expect(result.subject).toBe('Hello')
      expect(result.body).toBe('Body text for outreach.')
    }
    expect(mockFetch).toHaveBeenCalled()
    const openAICall = mockFetch.mock.calls.find(
      ([url]) => typeof url === 'string' && url.includes('api.openai.com'),
    )
    expect(openAICall, 'expected an OpenAI fetch to be made').toBeDefined()
    const [, init] = openAICall as [string, { body: string }]
    expect(JSON.parse(init.body).model).toBe('gpt-4o-mini')
  })

  it('returns existing when a draft for this template and meeting already exists and force is false', async () => {
    mockExistingDraftId = 'existing-draft-id'
    const { generateOutreachDraftInApp } = await import('../outreach-queue-generator')
    const result = await generateOutreachDraftInApp({ contactId: 99, force: false })

    expect(result).toEqual({
      outcome: 'existing',
      queueId: 'existing-draft-id',
      templateKey: 'email_cold_outreach',
      channel: 'email',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('passes the requested email templateKey to getSystemPrompt', async () => {
    const { generateOutreachDraftInApp } = await import('../outreach-queue-generator')
    await generateOutreachDraftInApp({
      contactId: 99,
      templateKey: 'email_follow_up',
      force: true,
    })

    expect(mockGetSystemPrompt).toHaveBeenCalledWith('email_follow_up')
  })

  it('persists a generation_inputs trace on email insert (Phase 2)', async () => {
    const { generateOutreachDraftInApp } = await import('../outreach-queue-generator')
    await generateOutreachDraftInApp({
      contactId: 99,
      templateKey: 'email_cold_outreach',
      force: true,
    })

    expect(lastOutreachInsertPayload).not.toBeNull()
    const inputs = lastOutreachInsertPayload?.generation_inputs as
      | Record<string, unknown>
      | undefined
    expect(inputs).toBeDefined()
    expect(inputs?.template_key).toBe('email_cold_outreach')
    expect(inputs?.channel).toBe('email')
    expect(inputs?.model).toBe('gpt-4o-mini')
    expect(inputs?.provider).toBe('openai')
    expect(inputs?.temperature).toBe(0.7)
    expect(inputs?.max_tokens).toBe(600)
    expect(inputs?.sequence_step).toBe(1)
    expect(inputs?.prompt_version).toBe(7)
    expect(typeof inputs?.research_brief_chars).toBe('number')
    expect(typeof inputs?.social_proof_chars).toBe('number')
    expect(inputs?.meeting_summary_present).toBe(false)
    expect(inputs?.meeting_action_items_chars).toBe(0)
    // EMAIL_RAG_ENABLED=false in beforeEach → pinecone block is empty
    expect(inputs?.pinecone_chars).toBe(0)
    expect(inputs?.prior_chat_present).toBe(false)
    expect(inputs?.pinecone_block_hash).toBeNull()
    // Phase 3 — empty prior outreach when there is no history.
    expect(inputs?.prior_outreach_chars).toBe(0)
    expect(inputs?.prior_outreach_entries).toBe(0)
    expect(inputs?.prior_outreach_has_inbound).toBe(false)
    expect(inputs?.meeting_text_source).toBe('none')
    expect(inputs?.value_evidence_chars).toBe(0)
    expect(inputs?.value_evidence_rows).toBe(0)
    expect(inputs?.rag_skipped_reason).toBe('email_rag_disabled')
    expect(inputs?.rag_attempted).toBe(false)
    expect(typeof inputs?.rag_query_chars).toBe('number')
    expect((inputs?.rag_query_chars as number) ?? 0).toBeGreaterThan(0)
    expect(inputs?.rag_empty_response).toBe(false)
  })

  it('reflects prior outreach history in generation_inputs (Phase 3)', async () => {
    const recentIso = new Date().toISOString()
    mockPriorOutreachRows = [
      {
        id: '00000000-0000-4000-8000-0000000000a1',
        channel: 'email',
        subject: 'Initial pitch',
        body: 'Saw your AI rollout — would love to compare notes.',
        sequence_step: 1,
        status: 'replied',
        reply_content: 'Thanks — let’s pick this up next week. — Kyle',
        sent_at: recentIso,
        replied_at: recentIso,
        created_at: recentIso,
      },
    ]

    const { generateOutreachDraftInApp } = await import('../outreach-queue-generator')
    await generateOutreachDraftInApp({
      contactId: 99,
      templateKey: 'email_cold_outreach',
      force: true,
    })

    expect(lastOutreachInsertPayload).not.toBeNull()
    const inputs = lastOutreachInsertPayload?.generation_inputs as
      | Record<string, unknown>
      | undefined
    expect(inputs).toBeDefined()
    expect(inputs?.prior_outreach_entries).toBe(1)
    expect((inputs?.prior_outreach_chars as number) ?? 0).toBeGreaterThan(0)
    expect(inputs?.prior_outreach_has_inbound).toBe(true)
  })
})

describe('formatLinkedInBody', () => {
  it('renders a CONNECTION NOTE / FOLLOW-UP DM block', async () => {
    const { formatLinkedInBody } = await import('../outreach-queue-generator')
    const out = formatLinkedInBody('Hi Acme!', 'Quick follow-up.')
    expect(out).toContain('CONNECTION NOTE')
    expect(out).toContain('Hi Acme!')
    expect(out).toContain('FOLLOW-UP DM (send 3-7 days after the invite is accepted)')
    expect(out).toContain('Quick follow-up.')
    expect(out.indexOf('CONNECTION NOTE')).toBeLessThan(out.indexOf('FOLLOW-UP DM'))
  })
})

describe('generateLinkedInDraftInApp', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    mockExistingDraftId = null
    mockInsertId = '00000000-0000-4000-8000-0000000000aa'
    lastOutreachInsertPayload = null
    mockPriorOutreachRows = []
    mockPriorInboundCommsRows = []
    mockGetSystemPrompt.mockResolvedValue({
      prompt:
        'LinkedIn outreach for {{research_brief}} from {{sender_name}}. Voice: {{social_proof}}',
      config: { model: 'gpt-4o-mini', temperature: 0.7, maxTokens: 600 },
      version: 3,
    })
    mockLoadLeadResearchBrief.mockResolvedValue({
      contact: {
        name: 'LinkedIn Lead',
        email: 'li@example.com',
        company: 'Acme',
        industry: 'saas',
        job_title: null,
        employee_count: null,
        annual_revenue: null,
        location: null,
        interest_areas: null,
        interest_summary: null,
        rep_pain_points: null,
        quick_wins: null,
        ai_readiness_score: null,
        competitive_pressure_score: null,
        potential_recommendations_summary: null,
        website_tech_stack: null,
      },
      researchBrief: 'Research',
      socialProof: 'Proof',
    })
    mockRecordOpenAICost.mockResolvedValue(undefined)

    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                connection_note: 'Hi Acme — saw your AI work, would love to connect.',
                follow_up_dm:
                  'Quick note — three companies I work with cut prep time by 40% in 30 days.',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 9, total_tokens: 14 },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)
    process.env.OPENAI_API_KEY = 'sk-test-key'
    process.env.ENABLE_IN_APP_OUTREACH_GEN = 'true'
    process.env.EMAIL_RAG_ENABLED = 'false'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
    mockGetSystemPrompt.mockReset()
    mockLoadLeadResearchBrief.mockReset()
    mockRecordOpenAICost.mockReset()
    mockRecordAnthropicCost.mockReset()
  })

  it('inserts a LinkedIn draft with subject=null and a CONNECTION NOTE body', async () => {
    const { generateLinkedInDraftInApp } = await import('../outreach-queue-generator')
    const result = await generateLinkedInDraftInApp({ contactId: 99, force: true })

    expect(result.outcome).toBe('created')
    if (result.outcome === 'created') {
      expect(result.subject).toBeNull()
      expect(result.body).toContain('CONNECTION NOTE')
      expect(result.body).toContain('Hi Acme — saw your AI work')
      expect(result.body).toContain('FOLLOW-UP DM (send 3-7 days after the invite is accepted)')
      expect(result.body).toContain('cut prep time by 40%')
    }
  })

  it('caps the connection note at the LinkedIn invite limit', async () => {
    const longNote = 'A'.repeat(500)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                connection_note: longNote,
                follow_up_dm: 'short follow up',
              }),
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    })

    const { generateLinkedInDraftInApp, LINKEDIN_CONNECTION_NOTE_MAX_CHARS } = await import(
      '../outreach-queue-generator'
    )
    const result = await generateLinkedInDraftInApp({ contactId: 99, force: true })

    expect(result.outcome).toBe('created')
    if (result.outcome === 'created') {
      // Extract only the note text (after the CONNECTION NOTE heading,
      // before the --- separator).
      const noteOnly = result.body
        .split('---')[0]
        .replace(/^CONNECTION NOTE\s*/i, '')
        .trim()
      expect(noteOnly.length).toBeLessThanOrEqual(LINKEDIN_CONNECTION_NOTE_MAX_CHARS)
      expect(noteOnly.endsWith('…')).toBe(true)
    }
  })

  it('passes the requested LinkedIn templateKey to getSystemPrompt', async () => {
    const { generateLinkedInDraftInApp } = await import('../outreach-queue-generator')
    await generateLinkedInDraftInApp({
      contactId: 99,
      templateKey: 'linkedin_cold_outreach',
      force: true,
    })

    expect(mockGetSystemPrompt).toHaveBeenCalledWith('linkedin_cold_outreach')
  })

  it('persists a generation_inputs trace on LinkedIn insert (Phase 2)', async () => {
    const { generateLinkedInDraftInApp } = await import('../outreach-queue-generator')
    await generateLinkedInDraftInApp({
      contactId: 99,
      templateKey: 'linkedin_cold_outreach',
      force: true,
    })

    expect(lastOutreachInsertPayload).not.toBeNull()
    const inputs = lastOutreachInsertPayload?.generation_inputs as
      | Record<string, unknown>
      | undefined
    expect(inputs).toBeDefined()
    expect(inputs?.template_key).toBe('linkedin_cold_outreach')
    expect(inputs?.channel).toBe('linkedin')
    expect(inputs?.model).toBe('gpt-4o-mini')
    expect(inputs?.provider).toBe('openai')
    expect(inputs?.prompt_version).toBe(3)
    expect(inputs?.sequence_step).toBe(1)
    expect(typeof inputs?.research_brief_chars).toBe('number')
    expect(typeof inputs?.social_proof_chars).toBe('number')
    expect(inputs?.meeting_summary_present).toBe(false)
    expect(inputs?.pinecone_chars).toBe(0)
    expect(inputs?.prior_chat_present).toBe(false)
    expect(inputs?.pinecone_block_hash).toBeNull()
    expect(inputs?.meeting_text_source).toBe('none')
    expect(inputs?.rag_skipped_reason).toBe('email_rag_disabled')
  })
})
