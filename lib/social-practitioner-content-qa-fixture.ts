import type { SocialContentItem } from '@/lib/social-content'

export const PRACTITIONER_CONTENT_QA_ID = 'practitioner-content-quality-qa'
export type PractitionerContentQaScriptSize = 'complete' | 'short' | 'medium' | 'over-cap'

const COMPLETE_PRACTITIONER_POST = [
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

const MEDIUM_SCRIPT = [
  'A nonprofit operations lead reconciled one intake across three spreadsheets every Friday.',
  'Weekly volunteer coverage changed, but the rules could not drift.',
  'We moved the rules into one reviewed queue and kept the final decision with the lead.',
  'The duplicate review disappeared. The 30-day outcome check remains pending.',
].join('\n\n')

const SCRIPT_BY_SIZE: Record<PractitionerContentQaScriptSize, string> = {
  complete: COMPLETE_PRACTITIONER_POST,
  short: 'One reviewed queue replaced three duplicate checks.',
  medium: MEDIUM_SCRIPT,
  'over-cap': Array.from({ length: 32 }, (_, index) => (
    `${index + 1}. The operations lead reviewed one synthetic workflow note while the 30-day outcome remained pending.`
  )).join('\n\n'),
}

export function practitionerContentQaFixtureEnabled() {
  if (process.env.VERCEL_ENV === 'production') return false

  return process.env.SOCIAL_PRACTITIONER_CONTENT_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function isPractitionerContentQaFixtureId(id: string | null | undefined) {
  return practitionerContentQaFixtureEnabled() && id === PRACTITIONER_CONTENT_QA_ID
}

export function practitionerContentQaFixture(
  state: 'ready' | 'blocked' = 'ready',
  scriptSize: PractitionerContentQaScriptSize = 'complete',
): SocialContentItem {
  const blocked = state === 'blocked'
  const postText = SCRIPT_BY_SIZE[scriptSize]

  return {
    id: PRACTITIONER_CONTENT_QA_ID,
    meeting_record_id: null,
    platform: 'linkedin',
    status: 'draft',
    post_text: postText,
    cta_text: null,
    cta_url: null,
    hashtags: ['AIProduct', 'ProductManagement', 'AmaduTownAdvisory'],
    image_url: null,
    image_prompt: null,
    framework_visual_type: 'architecture',
    voiceover_url: null,
    voiceover_text: postText,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: {
      framework_type: 'proof_stacking',
      hook_type: 'operational_scene',
      proof_pattern: 'constraint_mechanism_bounded_result',
      cta_pattern: 'specific_operator_question',
    },
    scheduled_for: null,
    published_at: null,
    platform_post_id: null,
    admin_notes: 'Synthetic preview-only practitioner quality fixture. No shared row exists.',
    reviewed_by: null,
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    content_format: 'single_image',
    content_pillar: 'technology_as_equalizer',
    companion_post_text: null,
    carousel_slides: null,
    carousel_pdf_url: null,
    carousel_slide_urls: null,
    publishes: [],
    created_at: '2026-10-09T10:00:00.000Z',
    updated_at: '2026-10-09T10:05:00.000Z',
    rag_context: {
      source: 'social_practitioner_content_qa_fixture',
      source_type: 'synthetic_preview_fixture',
      campaign_id: 'synthetic-practitioner-quality',
      campaign_name: 'Practitioner evidence QA',
      channel: 'linkedin',
      planned_angle: 'Show the operating constraint, decision, and bounded result.',
      publish_gate: 'draft_only',
      external_execution_enabled: false,
      approval_boundary: 'Synthetic preview review only. No provider, upload, scheduling, publishing, or shared-data action is available.',
      qa_fixture: {
        id: PRACTITIONER_CONTENT_QA_ID,
        kind: 'synthetic_preview',
        read_only: true,
        reason: 'Preview fixture is read-only.',
        next_action: 'Review the evidence, then return to Social Content or the PR handoff.',
      },
      practitioner_content_quality: {
        version: 'practitioner_evidence_v1',
        evidence_packet: {
          status: blocked ? 'draft' : 'approved',
          situation: 'A nonprofit operations lead reconciled the same intake in three spreadsheets every Friday.',
          operational_constraint: 'Volunteer coverage changed weekly while the intake rules needed to stay stable.',
          practitioner_only_detail: 'The lead checked one duplicate review queue before the Friday handoff.',
          decision_intervention: 'The team moved the rules into one reviewed queue and kept the final decision with the operations lead.',
          observable_result: {
            status: 'metric_pending',
            summary: 'The duplicate review step disappeared; the 30-day outcome check remains pending.',
            metric: '30-day outcome check pending',
          },
          approved_public_details: [
            'reconciling the same intake in three spreadsheets every Friday',
            'volunteer coverage changed weekly but the intake rules could not drift',
            'kept the final decision with the operations lead',
          ],
          supported_claims: ['30-day outcome check is still pending'],
          disclosure_boundary: {
            classification: 'anonymized',
            summary: 'Role, workflow, and decision pattern may be shared. Organization and people remain unnamed.',
            prohibited_details: ['organization name', 'person name', 'contact details'],
          },
          source_provenance: blocked ? [] : [{
            source_id: 'synthetic-preview-source-1',
            source_type: 'approved_practitioner_summary',
            label: 'Synthetic operator summary',
            approved_for_public_use: true,
          }],
          redaction_receipt: {
            receipt_id: blocked ? '' : 'redaction-synthetic-preview-1',
            status: blocked ? 'pending' : 'passed',
            reviewed_at: blocked ? null : '2026-10-09T10:00:00.000Z',
            redactions: ['organization name', 'person name'],
            unresolved_identifier_types: [],
          },
        },
        framework_application: {
          receipt_id: blocked ? '' : 'framework-application-synthetic-preview-1',
          status: blocked ? 'draft' : 'applied',
          applied_at: blocked ? null : '2026-10-09T10:00:00.000Z',
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
            principles_applied: [
              'Open with a concrete operating burden.',
              'Move from the system problem to a usable operator test.',
            ],
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
          template: 'constraint_decision_result',
          aspect_ratio: '1.91:1',
          eyebrow: 'Operator system map',
          headline: 'Make the repeated burden visible. Keep judgment human.',
          evidence_lines: ['Three spreadsheets', 'Changing volunteer coverage', 'One reviewed queue', 'Decision owner stays human', '30-day metric pending'],
          result_label: '30-day metric pending',
          argument_map: {
            context: 'Every Friday, three spreadsheets fed one intake decision.',
            constraint: 'Volunteer coverage changed while intake rules had to stay consistent.',
            decision_mechanism: 'One reviewed queue kept the final call with the operations lead.',
            result_boundary: 'Duplicate review disappeared; the 30-day outcome remains pending.',
            practical_takeaway: 'Start with repeated burden, stable rules, and one decision owner.',
          },
          visual_rationale: 'Map the full operator argument from weekly burden through bounded result and takeaway without exposing the organization.',
          candidate: {
            candidate_id: 'visual-candidate-synthetic-preview-1',
            status: blocked ? 'draft' : 'in_review',
            renderer: 'html_svg',
            artifact_url: null,
          },
          art_direction_receipt: {
            provider: 'none',
            model: null,
            receipt_id: 'local-deterministic-synthetic-preview-1',
            status: 'not_called',
          },
        },
      },
      content_calibration: {
        experiment_tags: {
          experiment_id: blocked ? '' : 'practitioner-depth-preview-001',
          anecdote_depth: 'scene',
          specificity: 'high',
          evidence_type: 'metric_pending',
          hook_framework: 'operational_scene',
          channel: 'linkedin',
          visual_treatment: 'deterministic_constraint_decision_result',
          hypothesis: blocked ? '' : 'A concrete operating scene may correlate with more substantive comments than a theory-led post.',
          causal_claim_boundary: 'correlational_only',
          captured_engagement: null,
        },
      },
    },
  } as unknown as SocialContentItem
}
