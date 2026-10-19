import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SocialCampaignPackagePreparation from './SocialCampaignPackagePreparation'
import { SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { evaluateCampaignPreparationCandidate } from '@/lib/social-campaign-package-preparation'
import { projectCampaignLongFormBatch, projectCampaignLongFormDraft } from '@/lib/social-campaign-long-form-batch'

vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn(async () => ({ access_token: 'staff-token' })) }))

const candidates = socialCampaignPackageQaCandidates()
const responseBody = () => ({
  candidates: candidates.map((candidate) => ({ candidate, evaluation: evaluateCampaignPreparationCandidate(candidate, new Date('2026-10-19T12:00:00.000Z')) })),
  long_form_inventory: candidates.map((candidate) => ({ ...projectCampaignLongFormDraft(candidate, new Date('2026-10-19T12:00:00.000Z')), packet: null })),
  runs: [],
  retry_policy: { maximum_attempts_per_input_version: 2, retry_limit: 1, duplicate_records_allowed: false, source_change_requires_new_input_version: true },
  external_gates: { provider_calls: false, uploads: false, scheduling: false, publishing: false },
  fixture: true,
  integration_note: 'Synthetic development-only operator workflow.',
})

describe('SocialCampaignPackagePreparation', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}'))
        if (body.action === 'prepare_long_form_batch') {
          const batch = projectCampaignLongFormBatch(candidates, new Date('2026-10-19T12:00:00.000Z'))
          return { ok: true, json: async () => ({ run: { id: 'qa-long-form-batch', status: 'completed', subject_id: batch.batch_id, subject_label: 'Current campaign backlog', current_step: 'Prepared eligible long-form scripts for human review', metadata: { long_form_batch: batch, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: 2 }, outcome: {}, idempotency_key: 'long-form-stable-key', created_at: '2026-10-19T12:00:00.000Z', updated_at: '2026-10-19T12:00:00.000Z', completed_at: '2026-10-19T12:00:00.000Z' }, duplicate: false }) } as Response
        }
        return { ok: true, json: async () => ({ run: { id: 'qa-run', status: 'completed', subject_id: 'candidate:kicklab:campaign:v1', subject_label: 'KickLab', current_step: 'Prepared for canonical Decision Queue review', metadata: { package: evaluateCampaignPreparationCandidate(candidates[0], new Date('2026-10-19T12:00:00.000Z')).package, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: 2 }, outcome: {}, idempotency_key: 'stable-key', created_at: '2026-10-19T12:00:00.000Z', updated_at: '2026-10-19T12:00:00.000Z', completed_at: '2026-10-19T12:00:00.000Z' }, duplicate: false }) } as Response
      }
      return { ok: true, json: async () => responseBody() } as Response
    }))
  })

  it('shows exact blockers and recovery before allowing preparation', async () => {
    render(<SocialCampaignPackagePreparation qaFixture={SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE} />)
    expect(await screen.findByRole('option', { name: /KickLab/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /ReversR rebuild/i }))
    expect(screen.getByText('Preparation blocked')).toBeInTheDocument()
    expect(screen.getByText(/evidence is stale/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Refresh evidence/i })).toHaveAttribute('href', expect.stringContaining('content-intelligence'))
    expect(screen.getByRole('button', { name: /Prepare review package/i })).toBeDisabled()
  })

  it('prepares a ready package, exposes its receipt history, and keeps approval in Decision Queue', async () => {
    render(<SocialCampaignPackagePreparation qaFixture={SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE} />)
    const button = await screen.findByRole('button', { name: /Prepare review package/i })
    expect(screen.getByText(/deliverables remain sealed/i)).toBeInTheDocument()
    fireEvent.click(button)
    expect(await screen.findByText(/Review package prepared/i)).toBeInTheDocument()
    expect(screen.getByText('Prepared for canonical Decision Queue review')).toBeInTheDocument()
    expect(screen.getByText('Attempt 1 of 2 · Retry 0 of 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Open canonical Decision Queue/i })).toHaveAttribute('href', expect.stringContaining('/admin/agents/coordination'))
    expect(screen.getByText(/zero performance weight/i)).toBeInTheDocument()
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('qa_fixture'), expect.objectContaining({ method: 'POST' })))
  })

  it('prepares the mixed long-form backlog batch and keeps the blocked recovery visible', async () => {
    render(<SocialCampaignPackagePreparation qaFixture={SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE} />)
    const button = await screen.findByRole('button', { name: 'Prepare eligible long-form scripts' })
    expect(screen.getByText(/Long-form draft scripts remain sealed/i)).toBeInTheDocument()
    fireEvent.click(button)
    expect(await screen.findByText('2 prepared · 1 blocked · 3 scanned')).toBeInTheDocument()
    expect(screen.getByText(/ReversR rebuild · Blocked/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Refresh evidence' })).toHaveAttribute('href', expect.stringContaining('content-intelligence'))
    expect(screen.getAllByText(/topic evidence passed · creator distance passed/i)).toHaveLength(2)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('qa_fixture'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'prepare_long_form_batch' }) })))
  })
})

