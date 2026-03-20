/**
 * Server-side demo seed data (replaces SQL scripts for Admin → Testing E2E).
 * Called only from POST /api/admin/testing/demo-seed (verifyAdmin).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const DEMO_SEED_KEYS = [
  'sarah_mitchell_lead',
  'paid_proposal_jordan',
  'lead_qualification_99999',
  'onboarding_test_project',
  'kickoff_test_project',
  'discovery_call_test_contact',
] as const

export type DemoSeedKey = (typeof DEMO_SEED_KEYS)[number]

export function isDemoSeedKey(k: string): k is DemoSeedKey {
  return (DEMO_SEED_KEYS as readonly string[]).includes(k)
}

const SARAH_SESSION = 'test-lead-session-001'
const SARAH_EMAIL = 'sarah.mitchell@techflow.io'

const BUSINESS_CHALLENGES = {
  primary_challenges: [
    'Manual lead follow-up taking too long',
    'Inconsistent sales messaging',
    'No visibility into pipeline health',
  ],
  pain_points: [
    'Losing deals due to slow response times',
    'Sales team spending 60% of time on admin tasks',
  ],
  current_impact: 'Estimated $200K in lost revenue due to slow follow-up',
  attempted_solutions: ['Hired more sales reps', 'Tried Zapier but hit limitations'],
}

const TECH_STACK = {
  crm: 'HubSpot',
  email: 'Google Workspace',
  marketing: 'Mailchimp',
  analytics: 'Google Analytics',
  other_tools: ['Slack', 'Notion', 'Calendly'],
  integration_readiness: 'High - all tools have APIs',
}

const AUTOMATION_NEEDS = {
  priority_areas: ['Lead scoring and routing', 'Automated follow-up sequences', 'Pipeline reporting'],
  desired_outcomes: [
    'Respond to leads within 5 minutes',
    'Personalized outreach at scale',
    'Real-time deal insights',
  ],
  complexity_tolerance: 'Medium - want results fast but willing to invest in setup',
}

const AI_READINESS = {
  data_quality: 'Good - clean CRM data',
  team_readiness: 'Excited about AI tools',
  previous_ai_experience: 'Used ChatGPT for email templates',
  concerns: ['Data privacy', 'Cost'],
  readiness_score: 7,
}

const BUDGET_TIMELINE = {
  budget_range: '$5,000-$15,000',
  timeline: 'Want to start within 30 days',
  decision_timeline: 'Can decide within 2 weeks',
  budget_flexibility: 'Could increase for proven ROI',
}

const DECISION_MAKING = {
  decision_maker: true,
  stakeholders: ['CEO', 'Sales Manager'],
  approval_process: 'Sarah has final say for tools under $20K',
  previous_vendor_experience: 'Good - currently using 3 SaaS tools',
}

const PROPOSAL_LINE_ITEMS = [
  {
    content_type: 'project',
    content_id: '00000000-0000-0000-0000-000000000001',
    title: 'Custom AI Chatbot',
    description:
      'Full-stack AI chatbot with RAG pipeline, custom knowledge base, and multi-channel deployment.',
    offer_role: 'core_offer',
    price: 4500.0,
    perceived_value: 7500.0,
  },
  {
    content_type: 'service',
    content_id: '00000000-0000-0000-0000-000000000002',
    title: 'Chatbot Training & Handoff',
    description: 'Training session for client team on chatbot management and customization.',
    offer_role: 'upsell',
    price: 500.0,
    perceived_value: 1000.0,
  },
]

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

async function removeSarahMitchellChain(supabase: SupabaseClient): Promise<void> {
  const { data: contact } = await supabase
    .from('contact_submissions')
    .select('id')
    .eq('email', SARAH_EMAIL)
    .maybeSingle()

  if (contact?.id != null) {
    await supabase.from('diagnostic_audits').delete().eq('contact_submission_id', contact.id)
  }
  await supabase.from('diagnostic_audits').delete().eq('session_id', SARAH_SESSION)
  await supabase.from('contact_submissions').delete().eq('email', SARAH_EMAIL)
  await supabase.from('chat_sessions').delete().eq('session_id', SARAH_SESSION)
}

export async function runDemoSeed(
  key: DemoSeedKey,
  supabase: SupabaseClient
): Promise<{ ok: true; key: DemoSeedKey; detail: string } | { ok: false; error: string }> {
  try {
    switch (key) {
      case 'sarah_mitchell_lead': {
        await removeSarahMitchellChain(supabase)

        const { error: e1 } = await supabase.from('chat_sessions').insert({
          session_id: SARAH_SESSION,
          visitor_email: SARAH_EMAIL,
          visitor_name: 'Sarah Mitchell',
        })
        if (e1) return { ok: false, error: `chat_sessions: ${e1.message}` }

        const { data: contactRow, error: e2 } = await supabase
          .from('contact_submissions')
          .insert({
            name: 'Sarah Mitchell',
            email: SARAH_EMAIL,
            message:
              'I am looking for help automating our sales pipeline and improving our AI capabilities. We currently use HubSpot for CRM and are interested in integrating AI-powered lead scoring and automated follow-ups.',
            company: 'TechFlow Solutions',
            company_domain: 'techflow.io',
            linkedin_url: 'https://linkedin.com/in/sarahmitchell',
            annual_revenue: '$1M-$5M',
            interest_areas: ['ai_automation', 'sales_pipeline', 'workflow_optimization'],
            interest_summary: 'AI Automation, Sales Pipeline, Workflow Optimization',
            is_decision_maker: true,
            lead_score: 85,
            qualification_status: 'qualified',
            ai_readiness_score: 7,
            lead_source: 'website_form',
          })
          .select('id')
          .single()

        if (e2 || !contactRow) return { ok: false, error: `contact_submissions: ${e2?.message ?? 'no row'}` }

        const contactId = contactRow.id as number
        const now = new Date()
        const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

        const { error: e3 } = await supabase.from('diagnostic_audits').insert({
          audit_type: 'chat',
          session_id: SARAH_SESSION,
          contact_submission_id: contactId,
          status: 'completed',
          business_challenges: BUSINESS_CHALLENGES,
          tech_stack: TECH_STACK,
          automation_needs: AUTOMATION_NEEDS,
          ai_readiness: AI_READINESS,
          budget_timeline: BUDGET_TIMELINE,
          decision_making: DECISION_MAKING,
          diagnostic_summary:
            'Sarah from TechFlow Solutions is a highly qualified lead looking to automate their sales pipeline. They have a clear pain point (slow lead response times costing ~$200K), a compatible tech stack (HubSpot + Google), and budget authority. The urgency is high as they want to implement within 30 days.',
          key_insights: [
            'High urgency: Currently losing deals due to slow response times',
            'Strong tech foundation: HubSpot CRM with clean data',
            'Budget approved: $5K-$15K range with flexibility',
            'Decision maker: Can approve within 2 weeks',
            'AI-ready: Team is excited, some ChatGPT experience',
          ],
          recommended_actions: [
            'Schedule demo of AI-powered lead scoring solution',
            'Show ROI calculator based on their $200K lost revenue estimate',
            'Propose HubSpot integration that can go live in 2 weeks',
            'Address data privacy concerns with security documentation',
            'Offer pilot program to reduce perceived risk',
          ],
          urgency_score: 8,
          opportunity_score: 9,
          sales_notes:
            'Hot lead - Sarah is the decision maker with approved budget. Follow up within 24 hours. She mentioned competing with a similar solution from a competitor.',
          started_at: twoDaysAgo.toISOString(),
          completed_at: oneDayAgo.toISOString(),
        })
        if (e3) return { ok: false, error: `diagnostic_audits: ${e3.message}` }

        return { ok: true, key, detail: `Sarah Mitchell lead + diagnostic (contact id ${contactId})` }
      }

      case 'paid_proposal_jordan': {
        const jordanEmail = 'jordan@acmecorp.com'
        const bundleName = 'AI Chatbot Solution - Full Package'
        await supabase.from('proposals').delete().eq('client_email', jordanEmail).eq('bundle_name', bundleName)

        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 30)

        const { error } = await supabase.from('proposals').insert({
          client_name: 'Jordan Rivera',
          client_email: jordanEmail,
          client_company: 'Acme Corporation',
          bundle_name: bundleName,
          line_items: PROPOSAL_LINE_ITEMS,
          subtotal: 5000.0,
          total_amount: 5000.0,
          status: 'paid',
          paid_at: new Date().toISOString(),
          terms_text: 'Standard terms apply. 12-month warranty included.',
          valid_until: validUntil.toISOString(),
        })
        if (error) return { ok: false, error: `proposals: ${error.message}` }
        return { ok: true, key, detail: 'Paid proposal for Jordan Rivera' }
      }

      case 'lead_qualification_99999': {
        const { error } = await supabase.from('contact_submissions').upsert(
          {
            id: 99999,
            name: 'Test User',
            email: 'test-lead-qual-99999@example.com',
            company: 'Test Co',
            company_domain: 'test.com',
            linkedin_url: 'https://linkedin.com/in/test',
            annual_revenue: '100k_500k',
            interest_summary: 'AI adoption, process automation, lead qualification',
            message: 'Interested in exploring AI automation for our sales team.',
            is_decision_maker: true,
            lead_source: 'website_form',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        if (error) return { ok: false, error: `contact_submissions upsert: ${error.message}` }
        return { ok: true, key, detail: 'contact_submissions id=99999' }
      }

      case 'onboarding_test_project': {
        const email = 'test-onboarding@example.com'
        await supabase.from('client_projects').delete().eq('client_email', email)

        const { error } = await supabase.from('client_projects').insert({
          client_name: 'Test Onboarding Caller',
          client_email: email,
          project_status: 'active',
          project_name: 'Test Onboarding Project',
          project_start_date: addDaysISO(7),
          estimated_end_date: addDaysISO(90),
        })
        if (error) return { ok: false, error: `client_projects: ${error.message}` }
        return { ok: true, key, detail: 'Onboarding test client project' }
      }

      case 'kickoff_test_project': {
        const email = 'test-kickoff@example.com'
        await supabase.from('client_projects').delete().eq('client_email', email)

        const { error } = await supabase.from('client_projects').insert({
          client_name: 'Test Kickoff Caller',
          client_email: email,
          project_status: 'onboarding_completed',
          project_name: 'Test Kickoff Project',
          project_start_date: addDaysISO(7),
          estimated_end_date: addDaysISO(90),
        })
        if (error) return { ok: false, error: `client_projects: ${error.message}` }
        return { ok: true, key, detail: 'Kickoff test client project' }
      }

      case 'discovery_call_test_contact': {
        const email = 'test-discovery@example.com'
        await supabase.from('contact_submissions').delete().eq('email', email)

        const { error } = await supabase.from('contact_submissions').insert({
          name: 'Test Discovery Caller',
          email,
          company: 'Test Co',
          lead_source: 'website_form',
        })
        if (error) return { ok: false, error: `contact_submissions: ${error.message}` }
        return { ok: true, key, detail: 'test-discovery@example.com' }
      }

      default: {
        const _exhaustive: never = key
        return { ok: false, error: `Unknown key: ${_exhaustive}` }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
