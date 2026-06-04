import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ClientAiOpsSmokeEvidencePanel, { type ClientAiOpsSmokeEvidenceReview } from './ClientAiOpsSmokeEvidencePanel'

const review: ClientAiOpsSmokeEvidenceReview = {
  clientProjectId: 'project-1',
  source: 'synthetic_smoke_evidence_template',
  sideEffectsEnabled: false,
  capturesAccepted: false,
  nextAction: 'Capture authenticated smoke evidence with synthetic or explicitly test-owned data, then review before any live setup.',
  approvalBoundary: {
    liveSetupActions: 'agent_approvals_required',
    evidencePersistence: 'not_enabled_in_v1',
    clientDataMutation: 'agent_approvals_required',
  },
  smokeEvidence: {
    summary: {
      totalTargets: 3,
      pendingCapture: 2,
      readyForReview: 1,
      needsRedaction: 0,
      blocked: 0,
    },
    items: [
      {
        surface: 'Admin project detail',
        path: '/admin/client-projects/[synthetic-or-test-project-id]',
        status: 'ready_for_review',
        missingEvidence: [],
        screenshotPath: '/tmp/admin-smoke.png',
        nextAction: 'Attach the capture to the captain handoff for review.',
        clientSafe: true,
        sideEffectFree: true,
      },
      {
        surface: 'Client dashboard',
        path: '/client/dashboard/[synthetic-or-test-token]',
        status: 'pending_capture',
        missingEvidence: ['Setup Readiness panel is visible.'],
        screenshotPath: null,
        nextAction: 'Capture this target with synthetic or explicitly test-owned data only.',
        clientSafe: false,
        sideEffectFree: true,
      },
    ],
    reviewerChecklist: [
      'Confirm every capture uses synthetic or explicitly test-owned client data.',
      'Confirm screenshots and notes contain no secrets, tokens, credentials, personal account data, or raw client records.',
      'Confirm no OAuth, credential sync, provider write, workflow activation, outbound send, publishing, deploy mutation, or client-data mutation was attempted.',
    ],
    forbiddenActions: ['OAuth connection', 'credential sync', 'provider write', 'outbound send', 'client-data mutation'],
  },
}

describe('ClientAiOpsSmokeEvidencePanel', () => {
  it('renders the read-only smoke evidence review packet', () => {
    render(<ClientAiOpsSmokeEvidencePanel review={review} />)

    expect(screen.getByText('Smoke evidence review')).toBeInTheDocument()
    expect(screen.getByText('Manual smoke packet')).toBeInTheDocument()
    expect(screen.getByText('Live setup locked')).toBeInTheDocument()
    expect(screen.getByText('Review only')).toBeInTheDocument()
    expect(screen.getByText('Admin project detail')).toBeInTheDocument()
    expect(screen.getByText('Client dashboard')).toBeInTheDocument()
    expect(screen.getByText('1 evidence item pending')).toBeInTheDocument()
    expect(screen.getByText('OAuth connection')).toBeInTheDocument()
  })

  it('renders loading and error states without a packet', () => {
    const { rerender } = render(<ClientAiOpsSmokeEvidencePanel review={null} loading />)

    expect(screen.getByText('Loading smoke evidence template...')).toBeInTheDocument()

    rerender(<ClientAiOpsSmokeEvidencePanel review={null} error="Failed to load smoke evidence" />)

    expect(screen.getByText('Failed to load smoke evidence')).toBeInTheDocument()
  })
})
