import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SocialCampaignPackagePreparation from './SocialCampaignPackagePreparation'
import { SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE, socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { evaluateCampaignPreparationCandidate } from '@/lib/social-campaign-package-preparation'
import { projectCampaignLongFormBatch, projectCampaignLongFormDraft } from '@/lib/social-campaign-long-form-batch'
import { projectCampaignVisualBatch, projectCampaignVisualPlan } from '@/lib/social-campaign-visual-plan'

vi.mock('@/lib/auth', () => ({ getCurrentSession: vi.fn(async () => ({ access_token: 'staff-token' })) }))

const candidates = socialCampaignPackageQaCandidates()
const longFormCandidates = socialCampaignLongFormBatchQaCandidates()
const responseBody = () => ({
  candidates: candidates.map((candidate) => ({ candidate, evaluation: evaluateCampaignPreparationCandidate(candidate, new Date('2026-10-19T12:00:00.000Z')) })),
  long_form_inventory: longFormCandidates.map((candidate) => ({ ...projectCampaignLongFormDraft(candidate, new Date('2026-10-19T12:00:00.000Z')), packet: null })),
  visual_inventory: longFormCandidates.map((candidate) => ({ ...projectCampaignVisualPlan(candidate, new Date('2026-10-19T12:00:00.000Z')), plan: null })),
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
          const batch = projectCampaignLongFormBatch(longFormCandidates, new Date('2026-10-19T12:00:00.000Z'))
          return { ok: true, json: async () => ({ run: { id: 'qa-long-form-batch', status: 'completed', subject_id: batch.batch_id, subject_label: 'Current campaign backlog', current_step: 'Prepared eligible long-form scripts for human review', metadata: { long_form_batch: batch, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: 2 }, outcome: {}, idempotency_key: 'long-form-stable-key', created_at: '2026-10-19T12:00:00.000Z', updated_at: '2026-10-19T12:00:00.000Z', completed_at: '2026-10-19T12:00:00.000Z' }, duplicate: false }) } as Response
        }
        if (body.action === 'prepare_visual_batch') {
          const batch = projectCampaignVisualBatch(longFormCandidates, new Date('2026-10-19T12:00:00.000Z'))
          return { ok: true, json: async () => ({ run: { id: 'qa-visual-batch', status: 'completed', subject_id: batch.batch_id, subject_label: 'Current campaign visual backlog', current_step: 'Prepared eligible channel-native visual plans for human review', metadata: { visual_batch: batch, attempt_number: 1, retry_count: 0, retry_limit: 1, maximum_attempts: 2 }, outcome: {}, idempotency_key: 'visual-stable-key', created_at: '2026-10-19T12:00:00.000Z', updated_at: '2026-10-19T12:00:00.000Z', completed_at: '2026-10-19T12:00:00.000Z' }, duplicate: false }) } as Response
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
    expect(screen.getByText(/Package inputs pass; thumbnail approval remains Unscored/i)).toBeInTheDocument()
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
    expect(await screen.findByText('12 total · 12 scanned · 1 prepared · 11 blocked · 0 deferred · 0 remaining · 2 chunks')).toBeInTheDocument()
    expect(screen.getByText(/ReversR rebuild · Blocked/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Refresh evidence' })).toHaveAttribute('href', expect.stringContaining('content-intelligence'))
    fireEvent.click(screen.getByText('Can a Game Make Physics Feel Obvious? Inside KickLab'))
    expect(screen.getByRole('heading', { name: 'Full chaptered script' })).toBeVisible()
    expect(screen.getByText(/A punch, a corner, and a free kick look unrelated/)).toBeVisible()
    expect(screen.getByText(/Open and run KickLab, then comment with one surprising result/)).toBeVisible()
    expect(screen.getAllByText(/Oscar Owen \+ Vanessa Lau:/)).not.toHaveLength(0)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('qa_fixture'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'prepare_long_form_batch' }) })))
  })

  it('exposes the raster review direction, style evidence gap, and blocked recovery without false approval', async () => {
    render(<SocialCampaignPackagePreparation qaFixture={SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE} />)
    const button = await screen.findByRole('button', { name: 'Prepare eligible visual plans' })
    expect(screen.getByText(/Visual plans remain sealed/i)).toBeInTheDocument()
    fireEvent.click(button)
    expect(await screen.findByText('12 total · 12 scanned · 0 prepared · 12 blocked · 0 remaining · 2 chunks')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /KickLab · channel-native visual plan/i })).toBeVisible()
    expect(screen.getByLabelText('Clean customer-facing asset view')).toBeVisible()
    expect(screen.getByAltText(/review direction: MATH IN THE MOVE/i)).toBeVisible()
    expect(screen.getByText(/YouTube thumbnail · review direction, not approval-ready/i)).toBeVisible()
    expect(screen.getByText(/Typography Unscored · review direction only/i)).toBeVisible()
    expect(screen.getByText(/Ronaldo vs My Unbeatable Goalie Robot/i)).toBeVisible()
    expect(screen.getByText(/inspected thumbnails contain no display lettering/i)).toBeVisible()
    expect(screen.getByText(/Collect at least four current topic\/audience-matched thumbnails/i)).toBeVisible()
    const blocked = screen.getByLabelText('Blocked visual candidates')
    expect(within(blocked).getByText('Page 1 of 3')).toBeVisible()
    expect(within(blocked).getAllByText(/View \d+ exact blockers?/)).toHaveLength(4)
    fireEvent.click(within(blocked).getByRole('button', { name: 'Next blocked page' }))
    expect(within(blocked).getByText('Page 2 of 3')).toBeVisible()
    fireEvent.change(within(blocked).getByRole('textbox', { name: 'Search blocked visual candidates' }), { target: { value: 'ReversR' } })
    expect(within(blocked).getByText('Page 1 of 1')).toBeVisible()
    expect(within(blocked).getByText('ReversR rebuild · Blocked')).toBeVisible()
    expect(within(blocked).getAllByRole('link', { name: 'Refresh evidence' })[0]).toHaveAttribute('href', expect.stringContaining('content-intelligence'))
    fireEvent.change(within(blocked).getByRole('textbox', { name: 'Search blocked visual candidates' }), { target: { value: '' } })
    expect(within(blocked).getByText('Page 1 of 3')).toBeVisible()
    const trace = screen.getByText('Show field-level source trace and visual decisions')
    fireEvent.click(trace)
    expect(screen.getByText('Exact source deep links')).toBeVisible()
    expect(screen.getByText('Script-to-visual storyboard timing')).toBeVisible()
    expect(screen.getByText(/Playlist similarity Unscored/i)).toBeVisible()
    expect(screen.getByText(/No attributable similarity receipt supplied/i)).toBeVisible()
    expect(screen.getAllByText(/Observed \d+ \/ \d+ required/i).length).toBe(12)
    expect(screen.getAllByText(/Shot:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Pattern interrupt:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Typography:/i).length).toBeGreaterThan(0)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('qa_fixture'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'prepare_visual_batch' }) })))
  })
})

