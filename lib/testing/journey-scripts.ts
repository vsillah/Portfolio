/**
 * Client Journey Scripts — metadata catalog for seed SQL + trigger webhooks.
 *
 * Used by the Admin Testing UI to display, copy, and run scripts
 * grouped by journey stage (Prospect → Lead → Client).
 */

import type { JourneyStage } from './types'

export type ScriptActionType = 'seed_sql' | 'trigger_webhook' | 'stripe_checkout' | 'cleanup'

export interface JourneyScript {
  id: string
  label: string
  description: string
  stage: JourneyStage
  type: ScriptActionType

  /** Relative path to the seed SQL file (for seed_sql type) */
  seedSqlPath?: string

  /** Relative path to the mock payload JSON (for trigger_webhook type) */
  payloadPath?: string

  /**
   * Webhook path segment appended to N8N_BASE_URL.
   * The API handler builds the full URL: `${N8N_BASE_URL}/webhook/${webhookPath}`
   */
  webhookPath?: string

  /** Env var override — if set, the API uses this env var instead of building from webhookPath */
  webhookEnvVar?: string

  /** Human-readable prerequisite (shown in UI) */
  prereq?: string

  /** Script ID that must be completed before this one is actionable */
  prereqScriptId?: string

  /** One-line downstream impact description */
  downstreamImpact: string

  /** ID of the E2E scenario that validates the outcome of this script */
  relatedScenarioId?: string

  /** Display order within the stage group (lower = first) */
  order: number
}

// ============================================================================
// Prospect stage
// ============================================================================

const inboundLeadTrigger: JourneyScript = {
  id: 'inbound_lead_trigger',
  label: 'Inbound Lead Intake',
  description: 'Trigger WF-000: Inbound Lead Intake with a mock LinkedIn DM payload.',
  stage: 'prospect',
  type: 'trigger_webhook',
  payloadPath: 'scripts/inbound-lead-mock-payload.json',
  webhookPath: 'inbound-lead',
  downstreamImpact: 'Creates contact_submissions row; triggers lead qualification webhook.',
  relatedScenarioId: 'service_inquiry',
  order: 1,
}

// ============================================================================
// Lead stage
// ============================================================================

const leadQualSeed: JourneyScript = {
  id: 'lead_qualification_seed',
  label: 'Seed: Lead Qualification Test Row',
  description: 'Insert a test contact_submissions row for lead qualification testing.',
  stage: 'lead',
  type: 'seed_sql',
  seedSqlPath: 'scripts/seed-lead-qualification-test-row.sql',
  downstreamImpact: 'Creates contact_submissions row (id 99999) with B2B lead profile.',
  order: 1,
}

const leadQualTrigger: JourneyScript = {
  id: 'lead_qualification_trigger',
  label: 'Trigger: Lead Qualification',
  description: 'Trigger the Lead Research and Qualifying Agent workflow.',
  stage: 'lead',
  type: 'trigger_webhook',
  payloadPath: 'scripts/lead-qualification-mock-payload.json',
  webhookPath: 'b4bc3f71-8d92-4441-8f31-01118b85a610',
  webhookEnvVar: 'N8N_LEAD_WEBHOOK_URL',
  prereq: 'Run "Seed: Lead Qualification Test Row" first.',
  prereqScriptId: 'lead_qualification_seed',
  downstreamImpact: 'Enriches contact; updates lead_score and quick_wins on contact_submissions.',
  relatedScenarioId: 'warm_lead_pipeline',
  order: 2,
}

const discoverySeed: JourneyScript = {
  id: 'discovery_call_seed',
  label: 'Seed: Discovery Call Contact',
  description: 'Insert a test contact_submissions row for discovery call testing.',
  stage: 'lead',
  type: 'seed_sql',
  seedSqlPath: 'scripts/seed-discovery-call-test-contact.sql',
  downstreamImpact: 'Creates contact_submissions row for test-discovery@example.com.',
  order: 3,
}

const discoveryTrigger: JourneyScript = {
  id: 'discovery_call_trigger',
  label: 'Trigger: Discovery Call Booked (WF-000A)',
  description: 'Trigger WF-000A via WF-CAL Calendly Webhook Router with a mock invitee.created payload.',
  stage: 'lead',
  type: 'trigger_webhook',
  payloadPath: 'scripts/discovery-call-booked-mock-payload.json',
  webhookPath: 'calendly-webhook-router',
  prereq: 'Run "Seed: Discovery Call Contact" first. WF-CAL must be active.',
  prereqScriptId: 'discovery_call_seed',
  downstreamImpact: 'WF-000A updates contact, sends Slack notification, preps Gmail draft.',
  relatedScenarioId: 'chat_to_diagnostic',
  order: 4,
}

const clg003Trigger: JourneyScript = {
  id: 'clg_003_send_trigger',
  label: 'Trigger: Cold Lead Send & Follow-Up (WF-CLG-003)',
  description: 'Trigger WF-CLG-003 to send a cold outreach email and schedule follow-ups.',
  stage: 'lead',
  type: 'trigger_webhook',
  payloadPath: 'scripts/clg-003-send-mock-payload.json',
  webhookPath: 'clg-send',
  webhookEnvVar: 'N8N_CLG003_WEBHOOK_URL',
  downstreamImpact: 'Sends outreach email via Gmail; schedules follow-up sequence.',
  order: 5,
}

// ============================================================================
// Client stage
// ============================================================================

const stripeCheckout: JourneyScript = {
  id: 'stripe_test_checkout',
  label: 'Stripe Test Checkout (WF-001)',
  description: 'Create a Stripe test checkout to trigger WF-001: Client Payment Intake. Pay with test card 4242 4242 4242 4242.',
  stage: 'client',
  type: 'stripe_checkout',
  downstreamImpact: 'Creates order, marks proposal paid, creates client_projects + onboarding plan.',
  relatedScenarioId: 'browse_and_buy',
  order: 0,
}

const onboardingSeed: JourneyScript = {
  id: 'onboarding_call_seed',
  label: 'Seed: Onboarding Client Project',
  description: 'Insert a test client_projects row for onboarding call testing.',
  stage: 'client',
  type: 'seed_sql',
  seedSqlPath: 'scripts/seed-onboarding-test-client-project.sql',
  prereqScriptId: 'stripe_test_checkout',
  downstreamImpact: 'Creates client_projects row for test-onboarding@example.com (status: active).',
  order: 1,
}

const onboardingTrigger: JourneyScript = {
  id: 'onboarding_call_trigger',
  label: 'Trigger: Onboarding Call Booked (WF-001B)',
  description: 'Trigger WF-001B via WF-CAL Calendly Webhook Router.',
  stage: 'client',
  type: 'trigger_webhook',
  payloadPath: 'scripts/onboarding-call-booked-mock-payload.json',
  webhookPath: 'calendly-webhook-router',
  prereq: 'Run "Seed: Onboarding Client Project" first. WF-CAL must be active.',
  prereqScriptId: 'onboarding_call_seed',
  downstreamImpact: 'Updates client_projects status to onboarding_scheduled; stores Calendly URI.',
  relatedScenarioId: 'full_funnel',
  order: 2,
}

const kickoffSeed: JourneyScript = {
  id: 'kickoff_call_seed',
  label: 'Seed: Kickoff Client Project',
  description: 'Insert a test client_projects row for kickoff call testing.',
  stage: 'client',
  type: 'seed_sql',
  seedSqlPath: 'scripts/seed-kickoff-test-client-project.sql',
  prereqScriptId: 'onboarding_call_trigger',
  downstreamImpact: 'Creates client_projects row for test-kickoff@example.com (status: onboarding_completed).',
  order: 3,
}

const kickoffTrigger: JourneyScript = {
  id: 'kickoff_call_trigger',
  label: 'Trigger: Kickoff Call Booked (WF-002)',
  description: 'Trigger WF-002 via WF-CAL Calendly Webhook Router.',
  stage: 'client',
  type: 'trigger_webhook',
  payloadPath: 'scripts/kickoff-call-booked-mock-payload.json',
  webhookPath: 'calendly-webhook-router',
  prereq: 'Run "Seed: Kickoff Client Project" first. WF-CAL must be active.',
  prereqScriptId: 'kickoff_call_seed',
  downstreamImpact: 'Updates client_projects to kickoff_scheduled; sends prep email + creates Slack channel.',
  relatedScenarioId: 'browse_and_buy',
  order: 4,
}

const cleanupTestData: JourneyScript = {
  id: 'cleanup_test_data',
  label: 'Clean Up Test Data',
  description: 'Remove all seed rows created during this test session (contact_submissions + client_projects).',
  stage: 'client',
  type: 'cleanup',
  prereqScriptId: 'kickoff_call_trigger',
  downstreamImpact: 'Deletes test rows from contact_submissions and client_projects.',
  order: 99,
}

// ============================================================================
// Exports
// ============================================================================

export const ALL_JOURNEY_SCRIPTS: JourneyScript[] = [
  // Prospect
  inboundLeadTrigger,
  // Lead
  leadQualSeed,
  leadQualTrigger,
  discoverySeed,
  discoveryTrigger,
  clg003Trigger,
  // Client
  stripeCheckout,
  onboardingSeed,
  onboardingTrigger,
  kickoffSeed,
  kickoffTrigger,
  cleanupTestData,
]

export const JOURNEY_SCRIPTS_BY_ID: Record<string, JourneyScript> = Object.fromEntries(
  ALL_JOURNEY_SCRIPTS.map(s => [s.id, s])
)

export function getScriptsByStage(stage: JourneyStage): JourneyScript[] {
  return ALL_JOURNEY_SCRIPTS
    .filter(s => s.stage === stage)
    .sort((a, b) => a.order - b.order)
}

export const JOURNEY_STAGES: { id: JourneyStage; label: string }[] = [
  { id: 'prospect', label: 'Prospect' },
  { id: 'lead', label: 'Lead' },
  { id: 'client', label: 'Client' },
]
