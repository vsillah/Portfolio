import { fireEvent, render, screen } from '@testing-library/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutreachEmailGenerateRow, type OutreachEmailGenerateRowProps } from './OutreachEmailGenerateRow'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/lib/auth', () => ({
  getCurrentSession: vi.fn(async () => ({ access_token: 'admin-token' })),
}))

vi.mock('@/lib/hooks/useOutreachGeneration', () => ({
  useOutreachGeneration: () => ({
    state: 'idle',
    elapsedMs: 0,
    phaseLabel: 'Idle',
    lastTemplateKey: null,
    lastChannel: 'email',
    start: vi.fn(),
    cancel: vi.fn(),
    retry: vi.fn(),
    dismissResult: vi.fn(),
  }),
}))

const lead: OutreachEmailGenerateRowProps['lead'] = {
  id: 13697,
  name: 'ATAS Production Google Smoke Lead',
  email: 'smoke@example.com',
  company: 'Portfolio QA',
  job_title: 'Synthetic Contact',
  industry: 'Testing',
  phone_number: null,
  lead_source: 'warm_google_contacts',
  linkedin_url: null,
  quick_wins: null,
  message: null,
  rep_pain_points: null,
  messages_count: 1,
  messages_sent: 0,
  do_not_contact: false,
  removed_at: null,
  last_n8n_outreach_status: 'success',
  last_n8n_outreach_triggered_at: '2026-08-23T13:19:33.595Z',
  last_n8n_outreach_template_key: null,
  recent_email_drafts: [],
}

describe('OutreachEmailGenerateRow status language', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ meetings: [] })))
  })

  it('labels lead-level success as draft generation without implying send completion', async () => {
    render(<OutreachEmailGenerateRow lead={lead} />)

    const draftButton = screen.getByRole('button', {
      name: /Draft generated for ATAS Production Google Smoke Lead, not sent/i,
    })
    expect(draftButton).toBeInTheDocument()
    expect(draftButton).toHaveAttribute(
      'title',
      'Draft generated in the outreach queue. This is not a send confirmation.',
    )
    expect(screen.queryByText('Draft ready')).not.toBeInTheDocument()

    fireEvent.click(draftButton)

    expect(
      await screen.findByText(/this contact's draft queue and send history/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/Draft generated does not mean sent/i)).toBeInTheDocument()
  })
})
