import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SocialCampaignPackagePreparation from './SocialCampaignPackagePreparation'
import { SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE, SOCIAL_CAMPAIGN_PACKAGE_QA_FIXTURE, socialCampaignLongFormBatchQaCandidates, socialCampaignPackageQaCandidates } from '@/lib/social-campaign-package-qa-fixture'
import { evaluateCampaignPreparationCandidate } from '@/lib/social-campaign-package-preparation'
import { projectCampaignLongFormBatch, projectCampaignLongFormDraft } from '@/lib/social-campaign-long-form-batch'
import { projectCampaignVisualBatch, projectCampaignVisualPlan } from '@/lib/social-campaign-visual-plan'
import { socialCampaignApprovedAdaptationQaProjection } from '@/lib/social-campaign-approved-adaptation-qa-fixture'

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
    expect(screen.getByText(/expanded scan found five eligible recent Khan Academy AP Physics baseline videos, but zero of four exact-style matched examples/i)).toBeVisible()
    expect(screen.getByText(/2 context-only comparables \(weight 0\)/i)).toBeVisible()
    expect(screen.getByText(/Approval requires at least 4 matched-style examples at performance weight 1/i)).toBeVisible()
    expect(screen.getByText(/1\.5× the same-channel baseline/i)).toBeVisible()
    expect(screen.getByText(/matched sample remains 0 of 4/i)).toBeVisible()
    expect(screen.getByText(/Five eligible Khan Academy AP Physics videos provide a current same-channel baseline only; they do not substitute for matched-style candidates/i)).toBeVisible()
    const audit = screen.getByText(/Expanded public channel scan · 9 channels · 11 exact candidate videos/i)
    fireEvent.click(audit)
    expect(screen.getByText(/baseline 5 eligible; 30-day median 53,950 views/i)).toBeVisible()
    expect(screen.getAllByText(/typography differs from the evaluated short uppercase Inter treatment/i)).toHaveLength(2)
    expect(screen.getByText(/Future experiment hypothesis: after explicit publishing\/experiment authorization/i)).toBeVisible()
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

  it('shows exact Jev and Dark Castle bindings, full source storyboards, and blocked recovery in read-only review mode', async () => {
    const review = socialCampaignApprovedAdaptationQaProjection()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...responseBody(), approved_adaptation_review: review, integration_note: 'Local read-only projection.' }) }) as Response))
    render(<SocialCampaignPackagePreparation qaFixture={SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE} reviewOnly />)
    expect(await screen.findByRole('heading', { name: 'Upcoming YouTube campaign review' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Primary campaign hero thumbnails' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Dark Castle Chess · Human QA choice' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'AI Audit Calculator · Human QA choice' })).toBeVisible()
    expect(screen.getByText(/4 provider calls · 4 successful jobs · 0 retries · 0 uncertain results · observed separate charge \$0/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Jev · YouTube storyboard' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Dark Castle Chess · YouTube storyboard' })).toBeVisible()
    expect(screen.getByText(/Human QA re-review required/i)).toBeVisible()
    expect(screen.getByText(/Source ready · Human QA pending/i)).toBeVisible()
    expect(screen.getByText(/prior 67-second motion and approved music\/ducking receipts bind to the older adaptation input/i)).toBeVisible()
    expect(screen.getByText(/no current scene-timecode or audio-cue sheet/i)).toBeVisible()
    expect(screen.getAllByRole('heading', { name: 'Hero-led thumbnail candidates and complete storyboard' })).toHaveLength(2)
    expect(decodeURIComponent(screen.getByAltText(/Jev review-only YouTube thumbnail reading WHO OVERRIDES AI/i).getAttribute('src') ?? '')).toContain('?v=6ae8dce146cf')
    expect(screen.getByAltText(/Jev review-only YouTube thumbnail reading SCORE ≠ DECISION/i)).toBeVisible()
    expect(decodeURIComponent(screen.getByAltText(/WHO OVERRIDES AI.*actual-feed-size preview/i).getAttribute('src') ?? '')).toContain('?v=4d0db7a0b632')
    expect(screen.getByAltText(/SCORE ≠ DECISION.*actual-feed-size preview/i)).toBeVisible()
    expect(screen.getByAltText(/Dark Castle Chess review-only YouTube thumbnail reading REMEMBER THE WHY/i)).toBeVisible()
    expect(screen.getByAltText(/Dark Castle Chess review-only YouTube thumbnail reading SEE THE CONSEQUENCE/i)).toBeVisible()
    expect(screen.getByAltText(/AI Audit Calculator review-only YouTube thumbnail reading WHO OWNS THE CLEANUP/i)).toBeVisible()
    expect(screen.getByAltText(/AI Audit Calculator review-only YouTube thumbnail reading THE BILL HIDES HERE/i)).toBeVisible()
    expect(screen.getByAltText(/REMEMBER THE WHY.*actual-feed-size preview/i)).toBeVisible()
    expect(screen.getByAltText(/SEE THE CONSEQUENCE.*actual-feed-size preview/i)).toBeVisible()
    expect(screen.getByAltText(/WHO OWNS THE CLEANUP.*actual-feed-size preview/i)).toBeVisible()
    expect(screen.getByAltText(/THE BILL HIDES HERE.*actual-feed-size preview/i)).toBeVisible()
    expect(screen.getByLabelText('Dark Castle Chess thumbnail candidate comparison')).toBeVisible()
    expect(screen.getByLabelText('AI Audit Calculator thumbnail candidate comparison')).toBeVisible()
    expect(screen.getByLabelText('Jev thumbnail candidate comparison')).toBeVisible()
    expect(screen.getAllByRole('heading', { name: /Hero earns attention · product proof substantiates/i })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Current topic evidence' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Current live topic evidence' })).toHaveLength(2)
    expect(screen.getByText(/9 attributable long-form comparisons · 1 qualified outlier/i)).toBeVisible()
    expect(screen.getAllByText(/Curated playlist: taste calibration only · performance weight 0/i)).toHaveLength(4)
    const evidenceDetails = screen.getAllByText('Inspect live-evidence creative decisions')
    expect(evidenceDetails).toHaveLength(6)
    evidenceDetails.forEach((detail) => fireEvent.click(detail))
    expect(screen.getAllByText(/campaign-specific Vambah likeness makes the human decision owner concrete/i)).toHaveLength(2)
    expect(screen.getAllByText(/campaign-specific likeness makes the owner of the decision concrete/i)).toHaveLength(4)
    expect(screen.getAllByText('New campaign-specific generation · review only')).toHaveLength(6)
    expect(screen.getAllByText('Human QA pending · output ineligible')).toHaveLength(4)
    expect(screen.getByText('Selected · sole final output')).toBeVisible()
    expect(screen.getByText('Rejected · ineligible for output')).toBeVisible()
    expect(screen.getByText('Pointing-hand treatment reads as if the hand was severed.')).toBeVisible()
    expect(screen.getByText(/Human QA approved Candidate B as the sole final Jev thumbnail output/i)).toBeVisible()
    expect(screen.getAllByText('Review direction · blocked')).toHaveLength(2)
    expect(screen.getAllByText(/YouTube long-form scene board · 6 scenes · 4:00/i)).toHaveLength(2)
    expect(screen.getAllByText(/YouTube Shorts scene board · 3 scenes · 0:45/i)).toHaveLength(2)
    expect(screen.getAllByText(/Spoken conclusion and CTA:/i)).toHaveLength(4)
    expect(screen.getAllByText(/Exact identity binding/i)).toHaveLength(2)
    expect(screen.getAllByLabelText(/evidence gates/i)).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /Evaluate the exact thumbnail/i })).toHaveLength(1)
    expect(screen.queryByText(/provider none/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/new image generation/i)).toHaveLength(6)
    expect(screen.getByText('sha256:392b3e2a92c5ab65e4cc93706571df761bac7ea38631bf06002fd6b89f3302a2')).toBeVisible()
    expect(screen.getAllByText(/sha256:e6fc9ae4aadd61e3a871e8f7af2dd0a2d424d5c20ae6a8d0eac861b16e796bd5/).length).toBeGreaterThan(1)
    expect(screen.getAllByText(/sha256:4d3bc63ebaeb1aed344d64ed15ebb0ff865772de48b48249526ccce0b2c02e9e/).length).toBeGreaterThan(1)
    expect(screen.getAllByText(/Only 0 fresh, attributable same-topic outlier description\(s\) qualified; 3 are required\./i)).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Open exact Social Content item' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /Review the full-size and 320×180 candidates/i })).toHaveLength(2)
    expect(screen.getByText(/Source, script, title, thumbnail, and final-video readiness are missing/i)).toBeVisible()
    expect(screen.getByText(/Human QA status: review pending/i)).toBeVisible()
    expect(screen.queryByRole('button', { name: /Prepare eligible/i })).not.toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(SOCIAL_CAMPAIGN_APPROVED_ADAPTATION_QA_FIXTURE), expect.anything())
  })
})

