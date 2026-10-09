import type { SocialContentItem } from '@/lib/social-content'

export const PRACTITIONER_CONTENT_QA_ID = 'practitioner-content-quality-qa'

export function practitionerContentQaFixtureEnabled() {
  return process.env.SOCIAL_PRACTITIONER_CONTENT_QA_FIXTURE === 'true'
    || process.env.VERCEL_ENV === 'preview'
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test'
}

export function isPractitionerContentQaFixtureId(id: string | null | undefined) {
  return practitionerContentQaFixtureEnabled() && id === PRACTITIONER_CONTENT_QA_ID
}

export function practitionerContentQaFixture(state: 'ready' | 'blocked' = 'ready'): SocialContentItem {
  const blocked = state === 'blocked'
  const postText = [
    'A nonprofit operations lead was reconciling the same intake in three spreadsheets every Friday.',
    'Volunteer coverage changed weekly, but the intake rules could not drift.',
    'We moved the rules into one reviewed queue and kept the final decision with the operations lead.',
    'The duplicate review step disappeared. The 30-day outcome check is still pending.',
    'Where does duplicate review still show up in your workflow?',
  ].join('\n\n')

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
    voiceover_text: null,
    video_url: null,
    topic_extracted: null,
    hormozi_framework: null,
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
        deterministic_visual: {
          system_version: 'amadutown_deterministic_v1',
          template: 'constraint_decision_result',
          aspect_ratio: '1.91:1',
          eyebrow: 'Field note',
          headline: 'One queue. One decision owner.',
          evidence_lines: ['Three spreadsheets', 'Weekly volunteer changes', 'One reviewed queue'],
          result_label: '30-day metric pending',
          visual_rationale: 'Make the operating constraint and decision change visible without exposing the organization.',
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
