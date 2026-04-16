import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Verifies the N8N_OUTBOUND_DISABLED gate works across multiple functions.
 * Each test dynamically imports lib/n8n after setting env vars so the
 * module-level constants pick up the test values.
 */
describe('N8N_OUTBOUND_DISABLED gate', () => {
  const originalEnv = { ...process.env }
  let mockFetch: ReturnType<typeof vi.fn>
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockFetch = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' })
    vi.stubGlobal('fetch', mockFetch)
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    process.env.N8N_DISABLE_OUTBOUND = 'true'
    process.env.MOCK_N8N = 'false'
    process.env.N8N_LEAD_WEBHOOK_URL = 'https://test/lead'
    process.env.N8N_EBOOK_NURTURE_WEBHOOK_URL = 'https://test/ebook'
    process.env.N8N_CLG002_WEBHOOK_URL = 'https://test/clg002'
    process.env.N8N_CLG003_WEBHOOK_URL = 'https://test/clg003'
    process.env.N8N_VEP001_WEBHOOK_URL = 'https://test/vep001'
    process.env.N8N_VEP002_WEBHOOK_URL = 'https://test/vep002'
    process.env.N8N_WEBHOOK_URL = 'https://test/chat'
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  const functions: Array<{
    name: string
    call: (mod: Record<string, (...args: any[]) => any>) => Promise<unknown>
  }> = [
    {
      name: 'triggerLeadQualificationWebhook',
      call: (m) => m.triggerLeadQualificationWebhook({
        name: 'T', email: 'a@b.c', submissionId: '1', submittedAt: 'now', source: 'test',
      }),
    },
    {
      name: 'triggerEbookNurtureSequence',
      call: (m) => m.triggerEbookNurtureSequence({
        user_id: 'u1', user_email: 'a@b.c', lead_magnet_id: 'lm1',
        lead_magnet_title: 'T', lead_magnet_slug: 's', download_id: 'd1',
        download_timestamp: 'now',
      }),
    },
    {
      name: 'triggerOutreachGeneration',
      call: (m) => m.triggerOutreachGeneration({ contact_id: 1, score_tier: 'hot', lead_score: 90 }),
    },
    {
      name: 'triggerOutreachSend',
      call: (m) => m.triggerOutreachSend({
        outreach_id: 'o1', contact_submission_id: 1, channel: 'email',
        body: 'hi', sequence_step: 1, contact: { name: 'T', email: 'a@b.c' },
      }),
    },
    {
      name: 'triggerValueEvidenceExtraction',
      call: (m) => m.triggerValueEvidenceExtraction(),
    },
    {
      name: 'triggerSocialListening',
      call: (m) => m.triggerSocialListening(),
    },
    {
      name: 'triggerSocialContentExtraction',
      call: (m) => m.triggerSocialContentExtraction(),
    },
    {
      name: 'triggerSocialContentPublish',
      call: (m) => m.triggerSocialContentPublish({
        content_id: 'c1', platform: 'linkedin', post_text: 'hello',
      }),
    },
    {
      name: 'checkN8nHealth',
      call: (m) => m.checkN8nHealth(),
    },
    {
      name: 'sendToN8n',
      call: (m) => m.sendToN8n({ message: 'hi', sessionId: 's1' }),
    },
  ]

  for (const { name, call } of functions) {
    it(`${name} does not call fetch when outbound is disabled`, async () => {
      const mod = await import('../n8n')
      await call(mod as unknown as Record<string, (...args: any[]) => any>)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it(`${name} logs [N8N_DISABLED] when outbound is disabled`, async () => {
      const mod = await import('../n8n')
      await call(mod as unknown as Record<string, (...args: any[]) => any>)
      const logCalls = consoleSpy.mock.calls.map((c: unknown[]) => c[0])
      expect(logCalls.some((msg: string) => msg.includes('[N8N_DISABLED]'))).toBe(true)
    })
  }
})
