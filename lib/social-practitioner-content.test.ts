import { describe, expect, it } from 'vitest'
import {
  buildPractitionerContentQualityScaffold,
  validatePractitionerContentQuality,
} from './social-practitioner-content'

const thinCopy = [
  'A nonprofit operations lead was reconciling the same intake in three spreadsheets every Friday.',
  'The constraint was simple: volunteers changed weekly, but the intake rules could not drift.',
  'We moved the rules into one reviewed queue and kept the final decision with the operations lead.',
  'The duplicate review step disappeared. The 30-day outcome check is still pending.',
].join('\n\n')

const finishedCopy = [
  'Every Friday, a nonprofit operations lead opened three spreadsheets to answer one question: which intake record was ready for action?',
  'The work looked simple from a distance. One intake could appear in more than one file, so the lead reconstructed the record history before making a decision.',
  'Volunteer coverage changed week to week, the intake rules had to stay consistent, and the lead still carried the final decision.',
  'A bigger dashboard would have added another layer. The team needed one place where the rules stayed visible and the decision owner stayed human.',
  'We used a proof-stacking structure to redesign the workflow: show the burden, name the constraint, change one mechanism, then separate the result we can see from the result that still needs time.',
  'Each submission entered the same rule set, possible duplicates landed in one check, and the operations lead made the final call before the Friday handoff.',
  'The duplicate review step disappeared from the weekly process, while the 30-day outcome check remains pending.',
  'That boundary matters. A cleaner handoff is visible now. Long-term impact still has to be measured.',
  'Many automation projects lose the operator at this point. A polished demo focuses on output. A working operating system makes authority, exceptions, and evidence visible to the person accountable for the outcome.',
  'Use four questions before choosing a model or building another dashboard:\n\n1. Where does the same work get reviewed twice?\n2. Which rule must stay stable when staffing changes?\n3. Who owns the final decision?\n4. What result can you observe now, and what still needs time?',
  "Start with the repeated burden, name the stable rule, keep one decision owner, and separate today's evidence from tomorrow's metric.",
  'The right automation makes the weekly process lighter while keeping judgment close to the people who understand the work.',
  'Where does duplicate review still show up in your workflow, and who should own the final decision when it disappears?',
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
      framework_application: {
        receipt_id: 'framework-application-synthetic-1',
        status: 'applied',
        applied_at: '2026-10-09T10:00:00.000Z',
        selected_framework: {
          framework_type: 'proof_stacking',
          hook_type: 'operational_scene',
          proof_pattern: 'constraint_mechanism_bounded_result',
          cta_pattern: 'specific_operator_question',
          approved_pattern_id: 'hormozi-proof-stacking',
          approved_pattern_source: 'social-content:hormozi-frameworks',
        },
        copy_beats: {
          hook_tension: 'Every Friday, a nonprofit operations lead opened three spreadsheets to answer one question: which intake record was ready for action?',
          practitioner_scene: 'Every Friday, a nonprofit operations lead opened three spreadsheets to answer one question: which intake record was ready for action?',
          operational_constraint: 'Volunteer coverage changed week to week, the intake rules had to stay consistent, and the lead still carried the final decision.',
          decision_mechanism: 'Each submission entered the same rule set, possible duplicates landed in one check, and the operations lead made the final call before the Friday handoff.',
          proof_result_boundary: 'The duplicate review step disappeared from the weekly process, while the 30-day outcome check remains pending.',
          practical_takeaway: "Start with the repeated burden, name the stable rule, keep one decision owner, and separate today's evidence from tomorrow's metric.",
          cta: 'Where does duplicate review still show up in your workflow, and who should own the final decision when it disappears?',
        },
        voice_calibration: {
          status: 'applied',
          reference_ids: ['linkedin-ai-reduces-burden'],
          principles_applied: ['Open with a concrete operating burden.', 'Move from the system problem to a usable operator test.'],
        },
        performance_calibration: {
          status: 'bounded_fallback',
          reference_ids: [],
          fallback_reason: 'No measured performance history is attached; the approved static reference shapes voice and structure only.',
          causal_claim_boundary: 'correlational_only',
        },
        content_shape: {
          format: 'standard_post',
          target_min_characters: 1800,
          target_max_characters: 2100,
          short_form_justification: null,
        },
      },
      deterministic_visual: {
        system_version: 'amadutown_deterministic_v1',
        visual_type: 'architecture',
        template: 'constraint_decision_result',
        aspect_ratio: '1.91:1',
        eyebrow: 'Field note',
        headline: 'One queue. One decision owner.',
        evidence_lines: ['Three spreadsheets', 'Weekly volunteer changes', 'One reviewed queue'],
        result_label: '30-day metric pending',
        argument_map: {
          context: 'Every Friday, three spreadsheets fed one intake decision.',
          constraint: 'Volunteer coverage changed while intake rules had to stay consistent.',
          decision_mechanism: 'One reviewed queue kept the final call with the operations lead.',
          result_boundary: 'Duplicate review disappeared; the 30-day outcome remains pending.',
          practical_takeaway: 'Start with repeated burden, stable rules, and one decision owner.',
        },
        visual_rationale: 'Use the operating constraint and the decision change as the visual hierarchy.',
        architecture: {
          nodes: [
            { id: 'constraint', label: 'Constraint', body: 'Volunteer coverage changed while intake rules had to stay consistent.' },
            { id: 'decision', label: 'Human decision', body: 'One reviewed queue kept the final call with the operations lead.' },
            { id: 'result', label: 'Bounded result', body: 'Duplicate review disappeared; the 30-day outcome remains pending.' },
          ],
          connectors: [
            { from: 'constraint', to: 'decision', label: 'Stable rules' },
            { from: 'decision', to: 'result', label: 'Owned decision' },
          ],
        },
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

function completeInput() {
  return {
    rag_context: approvedRagContext(),
    post_text: finishedCopy,
    cta_text: 'Where does duplicate review still show up in your workflow, and who should own the final decision when it disappears?',
    voiceover_text: null,
    youtube_title: null,
    youtube_description: null,
    hormozi_framework: {
      framework_type: 'proof_stacking' as const,
      hook_type: 'operational_scene',
      proof_pattern: 'constraint_mechanism_bounded_result',
      cta_pattern: 'specific_operator_question',
    },
  }
}

describe('practitioner content quality gate', () => {
  it('rejects the exact thin fixture when framework, calibration, copy-shape, and visual argument receipts are absent', () => {
    const ragContext = approvedRagContext()
    delete (ragContext.practitioner_content_quality as Record<string, unknown>).framework_application
    delete (ragContext.practitioner_content_quality.deterministic_visual as Record<string, unknown>).argument_map
    const gate = validatePractitionerContentQuality({
      rag_context: ragContext,
      post_text: thinCopy,
      cta_text: 'Where does duplicate review still show up in your workflow?',
      voiceover_text: null,
      youtube_title: null,
      youtube_description: null,
      hormozi_framework: null,
    })

    expect(gate.status).toBe('blocked')
    expect(gate.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'framework_unapplied',
      'framework_receipt_missing',
      'copy_structure_incomplete',
      'post_length_out_of_range',
      'calibration_trace_missing',
      'visual_argument_incomplete',
    ]))
  })

  it('passes approved, anonymized practitioner evidence and deterministic visual metadata', () => {
    const gate = validatePractitionerContentQuality(completeInput())

    expect(gate.status, JSON.stringify(gate.findings)).toBe('passed')
    expect(gate.specificity_result).toBe('specific')
    expect(gate.matched_public_details).toHaveLength(3)
    expect(gate.record?.engagement_experiment.causal_claim_boundary).toBe('correlational_only')
  })

  it('rejects label-only framework application when the receipt beats are not visible in the copy', () => {
    const input = completeInput()
    const quality = input.rag_context.practitioner_content_quality
    quality.framework_application.copy_beats = {
      hook_tension: 'Hook label only',
      practitioner_scene: 'Scene label only',
      operational_constraint: 'Constraint label only',
      decision_mechanism: 'Mechanism label only',
      proof_result_boundary: 'Proof label only',
      practical_takeaway: 'Takeaway label only',
      cta: 'CTA label only?',
    }

    const gate = validatePractitionerContentQuality(input)

    expect(gate.status).toBe('blocked')
    expect(gate.findings.map((finding) => finding.code)).toContain('copy_structure_incomplete')
  })

  it('rejects a missing voice and performance calibration trace', () => {
    const input = completeInput()
    const application = input.rag_context.practitioner_content_quality.framework_application
    application.voice_calibration.reference_ids = []
    application.performance_calibration.status = 'blocked'
    application.performance_calibration.fallback_reason = null

    const gate = validatePractitionerContentQuality(input)

    expect(gate.findings.map((finding) => finding.code)).toContain('calibration_trace_missing')
  })

  it('rejects a sparse visual that does not map the full post argument', () => {
    const input = completeInput()
    input.rag_context.practitioner_content_quality.deterministic_visual.argument_map = {
      context: 'Three spreadsheets',
      constraint: '',
      decision_mechanism: '',
      result_boundary: '',
      practical_takeaway: '',
    }

    const gate = validatePractitionerContentQuality(input)

    expect(gate.findings.map((finding) => finding.code)).toContain('visual_argument_incomplete')
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
