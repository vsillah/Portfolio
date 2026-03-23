/**
 * Mock Payloads for Pipeline Testing
 *
 * These payloads simulate what n8n workflows send to ingest endpoints.
 * All PII is synthetic; business context is realistic.
 * Every payload includes is_test_data: true for cleanup.
 */

import { SYNTHETIC_CONTACTS, MOCK_MEETING_TRANSCRIPTS } from './personas'

const contact = SYNTHETIC_CONTACTS

// ============================================================================
// Meeting Complete (WF-MCH: Calendly → meeting_records → sales_sessions)
// ============================================================================

export const MOCK_MEETING_COMPLETE_PAYLOAD = {
  is_test_data: true,
  meeting_type: 'discovery_call',
  meeting_date: new Date().toISOString(),
  duration_minutes: 30,
  calendly_event_uri: 'https://calendly.com/test/evt_test_mock_001',
  attendees: [
    { name: contact[0].name, email: contact[0].email },
    { name: 'Vambah Sillah', email: 'vambah@amadutown.com' },
  ],
  transcript: MOCK_MEETING_TRANSCRIPTS.discovery_call,
  recording_url: 'https://example.com/recordings/test-mock-001.mp4',
  raw_notes: 'Discovery call with healthcare IT prospect. Strong fit for document AI automation.',
  structured_notes: {
    key_decisions: ['Proceed with intake automation POC'],
    action_items: [
      'Send proposal for document AI pilot',
      'Schedule technical deep-dive with IT team',
    ],
    open_questions: ['Epic EHR integration timeline', 'HIPAA compliance requirements'],
    risks_identified: ['Legacy paper forms may have low OCR accuracy'],
  },
}

// ============================================================================
// Discovery Session (contact form → lead qualification → diagnostic)
// ============================================================================

export const MOCK_DISCOVERY_SESSION_PAYLOAD = {
  is_test_data: true,
  name: contact[1].name,
  email: contact[1].email,
  company: contact[1].company,
  companyDomain: 'apex-manufacturing.com',
  linkedinUrl: contact[1].linkedinUrl,
  phone: contact[1].phone,
  industry: contact[1].industry,
  message: 'We need help automating production scheduling across 4 manufacturing facilities. Currently using spreadsheets and losing $45K+ per scheduling conflict.',
  annualRevenue: '$10M-$50M',
  interestAreas: ['ai_automation', 'workflow_optimization'],
  interestSummary: 'AI Automation, Workflow Optimization',
  isDecisionMaker: true,
  submissionId: `test-discovery-${Date.now()}`,
  submittedAt: new Date().toISOString(),
  source: 'contact_form',
}

// ============================================================================
// Stripe Checkout Complete (WF-001: payment → client_projects)
// ============================================================================

export const MOCK_STRIPE_CHECKOUT_PAYLOAD = {
  is_test_data: true,
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_mock_001',
      customer_email: contact[2].email,
      customer_details: {
        name: contact[2].name,
        email: contact[2].email,
      },
      amount_total: 250000,
      currency: 'usd',
      payment_status: 'paid',
      metadata: {
        product_type: 'consulting_package',
        product_name: 'AI Strategy Sprint',
        is_test_data: 'true',
      },
    },
  },
}

// ============================================================================
// Warm Lead Ingest (WF-WRM → /api/admin/outreach/ingest)
// ============================================================================

export const MOCK_WARM_LEAD_INGEST_PAYLOAD = {
  is_test_data: true,
  leads: [
    {
      name: contact[3].name,
      email: contact[3].email,
      company: contact[3].company,
      job_title: contact[3].jobTitle,
      lead_source: 'warm_linkedin_connections' as const,
      relationship_strength: 'strong' as const,
      warm_source_detail: 'Connected on LinkedIn, engaged with 3 posts about AI in fintech',
      linkedin_url: contact[3].linkedinUrl,
      phone_number: contact[3].phone,
      industry: contact[3].industry,
    },
    {
      name: contact[4].name,
      email: contact[4].email,
      company: contact[4].company,
      job_title: contact[4].jobTitle,
      lead_source: 'warm_facebook_groups' as const,
      relationship_strength: 'moderate' as const,
      warm_source_detail: 'Active in Supply Chain Leaders group, commented on automation thread',
      facebook_profile_url: 'https://facebook.com/test-fatima-alrashid',
      phone_number: contact[4].phone,
      industry: contact[4].industry,
    },
  ],
}

// ============================================================================
// Value Evidence Extraction (WF-VEP-001 → /api/admin/value-evidence/ingest)
// ============================================================================

export const MOCK_VALUE_EVIDENCE_PAYLOAD = {
  is_test_data: true,
  evidence: [
    {
      pain_point_category_name: 'Manual Data Entry',
      pain_point_display_name: 'Manual Patient Intake Processing',
      pain_point_description: 'Healthcare organizations spending 20+ hours/day on manual data entry from paper forms into EHR systems',
      source_type: 'diagnostic_audit',
      source_id: 'test-diagnostic-001',
      source_excerpt: 'Front desk staff manually enters patient info from paper forms. 15 min per patient, 80-100 patients/day across three locations.',
      industry: 'Healthcare IT',
      company_size: '50-200',
      monetary_indicator: '$143,000',
      monetary_context: 'Annual labor cost for manual data entry (25 hrs/day × $22/hr × 260 days)',
      confidence_score: 0.85,
      extracted_by: 'test_pipeline',
    },
  ],
}

// ============================================================================
// Payload registry for Admin UI scenario selection
// ============================================================================

export const MOCK_PAYLOAD_REGISTRY = {
  meeting_complete: {
    label: 'Meeting Complete',
    description: 'Simulates a completed discovery call with transcript and structured notes',
    targetEndpoint: '/api/admin/meetings/ingest',
    payload: MOCK_MEETING_COMPLETE_PAYLOAD,
  },
  discovery_session: {
    label: 'Discovery Session',
    description: 'Simulates a contact form submission triggering lead qualification',
    targetEndpoint: '/api/contact',
    payload: MOCK_DISCOVERY_SESSION_PAYLOAD,
  },
  warm_lead_ingest: {
    label: 'Warm Lead Ingest',
    description: 'Simulates n8n warm lead scraping results being ingested',
    targetEndpoint: '/api/admin/outreach/ingest',
    payload: MOCK_WARM_LEAD_INGEST_PAYLOAD,
  },
  value_evidence: {
    label: 'Value Evidence',
    description: 'Simulates VEP-001 extracting pain point evidence',
    targetEndpoint: '/api/admin/value-evidence/ingest',
    payload: MOCK_VALUE_EVIDENCE_PAYLOAD,
  },
} as const

export type MockPayloadKey = keyof typeof MOCK_PAYLOAD_REGISTRY
