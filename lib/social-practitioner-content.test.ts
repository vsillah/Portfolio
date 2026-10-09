import { describe, expect, it } from 'vitest'
import {
  buildPractitionerContentQualityScaffold,
  validatePractitionerContentQuality,
} from './social-practitioner-content'

const finishedCopy = [
  'A nonprofit operations lead was reconciling the same intake in three spreadsheets every Friday.',
  'The constraint was simple: volunteers changed weekly, but the intake rules could not drift.',
  'We moved the rules into one reviewed queue and kept the final decision with the operations lead.',
  'The duplicate review step disappeared. The 30-day outcome check is still pending.',
].join('\n\n')

function approvedRagContext() {
  return {
    source: 'social_content_calendar_authorization',
    practitioner_content_quality: {
      version: 'practitioner_evidence_v1',
      evidence_packet: {
        status: 'approved',
        situation: 'A nonprofit operations lead reconciled the same intake in three spreadsheets every Friday.',
        operational_constraint: 'Volunteer coverage changed weekly while the intake rules needed to remain stable.',
        practitioner_only_detail: 'The practitioner checked one duplicate review queue before the Friday handoff.',
        decision_intervention: 'The team moved the rules into one reviewed queue and kept the final decision with the operations lead.',
        observable_result: {
          status: 'metric_pending',
          summary: 'The duplicate review step disappeared; a 30-day outcome check remains pending.',
          metric: '30-day outcome check pending',
        },
        approved_public_details: [
          'reconciling the same intake in three spreadsheets every Friday',
          'volunteers changed weekly but the intake rules could not drift',
          'kept the final decision with the operations lead',
        ],
        supported_claims: ['30-day outcome check is still pending'],
        disclosure_boundary: {
          classification: 'anonymized',
          summary: 'Role, workflow, and decision pattern may be shared. Organization and people remain unnamed.',
          prohibited_details: ['organization name', 'person name', 'contact details'],
        },
        source_provenance: [{
          source_id: 'synthetic-source-1',
          source_type: 'approved_practitioner_summary',
          label: 'Synthetic operator summary',
          approved_for_public_use: true,
        }],
        redaction_receipt: {
          receipt_id: 'redaction-synthetic-1',
          status: 'passed',
          reviewed_at: '2026-10-09T10:00:00.000Z',
          redactions: ['organization name', 'person name'],
          unresolved_identifier_types: [],
        },
      },
      deterministic_visual: {
        system_version: 'amadutown_deterministic_v1',
        template: 'constraint_decision_result',
        aspect_ratio: '1.91:1',
        eyebrow: 'Field note',
        headline: 'One queue. One decision owner.',
        evidence_lines: ['Three spreadsheets', 'Weekly volunteer changes', 'One reviewed queue'],
        result_label: '30-day metric pending',
        visual_rationale: 'Use the operating constraint and the decision change as the visual hierarchy.',
        candidate: {
          candidate_id: 'visual-candidate-synthetic-1',
          status: 'in_review',
          renderer: 'html_svg',
          artifact_url: null,
        },
        art_direction_receipt: {
          provider: 'none',
          model: null,
          receipt_id: 'local-deterministic-synthetic-1',
          status: 'not_called',
        },
      },
    },
    content_calibration: {
      experiment_tags: {
        experiment_id: 'practitioner-depth-001',
        anecdote_depth: 'scene',
        specificity: 'high',
        evidence_type: 'metric_pending',
        hook_framework: 'operational_scene',
        channel: 'linkedin',
        visual_treatment: 'deterministic_constraint_decision_result',
        hypothesis: 'A concrete operating scene may earn more substantive comments than a theory-led post.',
        causal_claim_boundary: 'correlational_only',
        captured_engagement: null,
      },
    },
  }
}

describe('practitioner content quality gate', () => {
  it('passes approved, anonymized practitioner evidence and deterministic visual metadata', () => {
    const gate = validatePractitionerContentQuality({
      rag_context: approvedRagContext(),
      post_text: finishedCopy,
      cta_text: 'Where does duplicate review still show up in your workflow?',
      voiceover_text: null,
      youtube_title: null,
      youtube_description: null,
    })

    expect(gate.status).toBe('passed')
    expect(gate.specificity_result).toBe('specific')
    expect(gate.matched_public_details).toHaveLength(3)
    expect(gate.record?.engagement_experiment.causal_claim_boundary).toBe('correlational_only')
  })

  it('fails closed on generic theory, missing provenance, privacy, tags, and candidate lifecycle', () => {
    const scaffold = buildPractitionerContentQualityScaffold({
      channel: 'linkedin',
      title: 'AI needs governance',
      plannedAngle: 'Explain a general framework.',
    })
    const gate = validatePractitionerContentQuality({
      rag_context: {
        source: 'social_content_calendar_authorization',
        ...scaffold,
      },
      post_text: 'AI governance matters. Teams need better systems and stronger review gates.',
      cta_text: null,
      voiceover_text: null,
      youtube_title: null,
      youtube_description: null,
    })

    expect(gate.status).toBe('blocked')
    expect(gate.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'packet_not_approved',
      'provenance_unapproved',
      'redaction_not_passed',
      'generic_theory',
      'experiment_tags_missing',
      'visual_candidate_not_ready',
    ]))
  })

  it('blocks unsupported numbers and third-person self-reference', () => {
    const gate = validatePractitionerContentQuality({
      rag_context: approvedRagContext(),
      post_text: `${finishedCopy}\n\nVambah learned that this saved 72% of the work.`,
      cta_text: null,
      voiceover_text: null,
      youtube_title: null,
      youtube_description: null,
    })

    expect(gate.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'third_person_self_reference',
      'unsupported_numeric_claim',
    ]))
  })
})
