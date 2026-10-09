import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PractitionerContentReview from './PractitionerContentReview'
import type { SocialContentItem } from '@/lib/social-content'

const item = {
  id: 'synthetic-social-1',
  platform: 'linkedin',
  status: 'draft',
  post_text: 'A nonprofit operations lead reconciled three spreadsheets every Friday. Volunteer coverage changed weekly. We moved the rules into one reviewed queue and kept the final decision with the operations lead.',
  cta_text: null,
  voiceover_text: null,
  youtube_title: null,
  youtube_description: null,
  image_url: 'https://example.invalid/legacy.png',
  rag_context: {
    source: 'social_content_calendar_authorization',
    practitioner_content_quality: {
      version: 'practitioner_evidence_v1',
      evidence_packet: {
        status: 'approved',
        situation: 'A nonprofit operations lead reconciled three spreadsheets every Friday.',
        operational_constraint: 'Volunteer coverage changed weekly while intake rules stayed stable.',
        practitioner_only_detail: 'The lead checked one duplicate review queue before the Friday handoff.',
        decision_intervention: 'Rules moved into one reviewed queue with a named decision owner.',
        observable_result: { status: 'metric_pending', summary: 'The duplicate review step disappeared.', metric: null },
        approved_public_details: ['reconciled three spreadsheets every Friday', 'volunteer coverage changed weekly', 'kept the final decision with the operations lead'],
        supported_claims: [],
        disclosure_boundary: { classification: 'anonymized', summary: 'Role and workflow only.', prohibited_details: ['names'] },
        source_provenance: [{ source_id: 'synthetic-1', source_type: 'approved_summary', label: 'Synthetic evidence', approved_for_public_use: true }],
        redaction_receipt: { receipt_id: 'redaction-1', status: 'passed', reviewed_at: '2026-10-09T10:00:00Z', redactions: ['names'], unresolved_identifier_types: [] },
      },
      deterministic_visual: {
        system_version: 'amadutown_deterministic_v1',
        template: 'practitioner_signal_card',
        aspect_ratio: '1.91:1',
        eyebrow: 'Field note',
        headline: 'One queue. One decision owner.',
        evidence_lines: ['Three spreadsheets', 'Weekly volunteer changes', 'One reviewed queue'],
        result_label: 'Metric pending',
        visual_rationale: 'Show the constraint and intervention without exposing the organization.',
        candidate: { candidate_id: 'candidate-1', status: 'in_review', renderer: 'html_svg', artifact_url: null },
        art_direction_receipt: { provider: 'none', model: null, receipt_id: 'local-1', status: 'not_called' },
      },
    },
    content_calibration: {
      experiment_tags: {
        experiment_id: 'experiment-1', anecdote_depth: 'scene', specificity: 'high', evidence_type: 'metric_pending',
        hook_framework: 'operational_scene', channel: 'linkedin', visual_treatment: 'deterministic_card',
        hypothesis: 'Concrete detail may correlate with substantive comments.', causal_claim_boundary: 'correlational_only',
      },
    },
  },
} as unknown as SocialContentItem

describe('PractitionerContentReview', () => {
  it('shows evidence, finished copy, deterministic candidate, and legacy-candidate boundary together', () => {
    render(<PractitionerContentReview item={item} finishedCopy={item.post_text} />)

    expect(screen.getByRole('region', { name: 'Practitioner evidence and visual review' })).toBeInTheDocument()
    expect(screen.getByText('Ready for Human QA')).toBeInTheDocument()
    expect(screen.getByText('One queue. One decision owner.')).toBeInTheDocument()
    expect(screen.getByText('Specificity: specific')).toBeInTheDocument()
    expect(screen.getByText('Correlation only')).toBeInTheDocument()
    expect(screen.getByText('Legacy generated candidate remains unapproved')).toBeInTheDocument()
  })

  it('shows the fail-closed state when privacy, provenance, and candidate receipts are incomplete', () => {
    const blockedItem = structuredClone(item) as SocialContentItem
    const quality = blockedItem.rag_context?.practitioner_content_quality as Record<string, any>
    quality.evidence_packet.status = 'draft'
    quality.evidence_packet.source_provenance = []
    quality.evidence_packet.redaction_receipt.status = 'pending'
    quality.deterministic_visual.candidate.status = 'draft'

    render(<PractitionerContentReview item={blockedItem} finishedCopy={blockedItem.post_text} />)

    expect(screen.getByText('Blocked before Human QA')).toBeInTheDocument()
    expect(screen.getByText('Resolve before Human QA')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(3)
  })
})
