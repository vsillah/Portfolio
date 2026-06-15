#!/usr/bin/env tsx

import { supabaseAdmin } from '@/lib/supabase'
import { calculateDreamOutcomeGap, calculateOverallScore, type CategoryScores } from '@/lib/assessment-scoring'

const args = new Set(process.argv.slice(2))

const CLIENT_EMAIL = process.env.MARK_MEADOWS_EMAIL || 'mark.meadows@offline.local'
const ASSESSMENT_KEY = 'mark-reversr-client-safe-assessment-v1'

const categoryScores: CategoryScores = {
  business_challenges: 68,
  tech_stack: 62,
  automation_needs: 52,
  ai_readiness: 48,
  budget_timeline: 45,
  decision_making: 38,
}

const assessmentPayload = {
  audit_type: 'from_meetings',
  status: 'completed',
  business_name: 'Vanguard Enterprises',
  website_url: 'http://vanguardenterprises.com/services---solutions.html',
  contact_email: CLIENT_EMAIL,
  industry_slug: 'engineering-services',
  report_tier: 'bronze',
  completed_at: new Date().toISOString(),
  metadata: {
    assessment_key: ASSESSMENT_KEY,
    client_safe: true,
    source_urls: ['http://vanguardenterprises.com/services---solutions.html'],
    source_summary:
      'Public Vanguard services page plus client-safe consultant discovery notes; excludes private prompts, raw chat logs, and relationship strategy notes.',
  },
  diagnostic_summary:
    'Vanguard Enterprises presents itself as a provider of project management, IT infrastructure, CAD, and CAM services. The ReversR rebuild extends that engineering-services posture into a product-asset workflow: a user-facing application that can help translate visual or design inputs into a clearer path toward manufacturable output, validation, and eventual ordering. The immediate business question is not whether engineering knowledge exists; it is whether the app can make that knowledge easier to access, trust, and convert into paid work without creating an open-ended consulting relationship.',
  key_insights: [
    'The public company positioning already supports a technology-plus-manufacturing frame: project management, IT infrastructure, CAD, and CAM.',
    'The ReversR app gives Vanguard a productized front door for engineering demand, but customer validation and order-flow design are still pending.',
    'The current build evidence is strong enough to support replacement-cost and fixed-fee discussion, while the commercial model still needs phase gates.',
    'The largest current gap is not code volume; it is decision clarity around scope, ownership, validation thresholds, and post-launch continuity.',
  ],
  recommended_actions: [
    'Use Phase 1 to validate that the core audience understands the app output and would pay for the resulting engineering/manufacturing workflow.',
    'Define the order path before Phase 2: website embed, intake requirements, review handoff, quote generation, and machine-build request flow.',
    'Decide whether local AI, cloud AI, or a hybrid model is required based on accuracy, security, cost, and hardware constraints.',
    'Separate consulting compensation, product/IP ownership, and any optional upside participation before expanding the roadmap.',
  ],
  business_challenges: {
    score: categoryScores.business_challenges,
    summary:
      'Vanguard has a clear public services frame around project management, IT infrastructure, CAD, and CAM, with stated emphasis on benchmark performance, quality control, and cost-effective solutions. ReversR can strengthen that frame by turning engineering expertise into a productized intake and validation experience. The remaining gap is sharper market definition: who the first buyer is, what job they trust the app to perform, and what commercial proof moves the work from prototype to offer.',
    current_state:
      'Public positioning is credible but broad. ReversR is a focused product asset, but the first paid use case and buyer segment still need validation.',
    dream_outcome:
      'A clear, client-safe product story: Vanguard helps customers move from visual/design input to manufacturable next steps and paid engineering/manufacturing orders.',
    evidence: ['Public services page: project management, IT infrastructure, CAD, CAM', 'ReversR build evidence dashboard'],
  },
  tech_stack: {
    score: categoryScores.tech_stack,
    summary:
      'The public website appears to be an older static business site, while the current ReversR rebuild is a modern application with AI-assisted vision/observability through Gemini. The core technical asset exists, but the website embed, production hosting posture, secure client access, and local/cloud AI architecture are not fully resolved.',
    current_state:
      'Legacy website plus a rebuilt app asset. Gemini is being used today for vision/observability; future local AI remains a larger infrastructure decision.',
    dream_outcome:
      'A secure, maintainable client-facing app embedded or linked from Vanguard’s web presence, with clear deployment, support, and AI architecture choices.',
    public_site_observations: ['Project Management', 'IT Infrastructure', 'Computer Aided Design (CAD)', 'Computer Aided Manufacturing (CAM)'],
    known_gaps: ['Website embed path', 'Production deployment model', 'Local-vs-cloud AI decision', 'Security/offline operating constraints'],
  },
  automation_needs: {
    score: categoryScores.automation_needs,
    summary:
      'The app can reduce the effort required to interpret inputs and prepare next-step engineering conversations, but the full automation path is still emerging. The order workflow, review handoff, quoting, and manufacturing request process need to be designed before the app can function as a reliable sales and delivery front door.',
    current_state:
      'Prototype/product asset reduces analysis burden, but order intake and manufacturing handoff are still manual or undefined.',
    dream_outcome:
      'A guided workflow that moves from app interaction to order submission, review, quote, and machine-build request with minimal avoidable back-and-forth.',
  },
  ai_readiness: {
    score: categoryScores.ai_readiness,
    summary:
      'AI is already present through Gemini-supported vision/observability, which is enough for Phase 1 validation. The next readiness gap is reliability: accuracy checks, source-backed outputs, local/cloud tradeoffs, and the hardware requirements for local AI if security or offline operation becomes mandatory.',
    current_state:
      'AI-assisted prototype with cloud model support. Validation thresholds and local AI requirements are not yet settled.',
    dream_outcome:
      'A validated AI workflow that produces trusted, observable outputs and can move to local, cloud, or hybrid architecture based on measured need.',
  },
  budget_timeline: {
    score: categoryScores.budget_timeline,
    summary:
      'Phase 1 should stay focused on app completion and audience validation. Phase 2 can expand into website embedding, order workflow, AI architecture, and potentially website management. Budget should be framed as fixed product/value investment with hourly translation only as a comparison lens.',
    current_state:
      'Build evidence exists and Phase 1 is underway. Future phases and pricing terms need explicit gates.',
    dream_outcome:
      'A phased roadmap where each expansion has a validation threshold, fixed-fee scope, and clear continuity or upsell option.',
  },
  decision_making: {
    score: categoryScores.decision_making,
    summary:
      'Decision-making is the weakest current area because the engagement needs clearer boundaries around consulting compensation, product ownership, optional upside, and long-term maintenance. The next proposal should make these decision gates explicit so both sides can collaborate without turning the work into an indefinite employee-style arrangement.',
    current_state:
      'There is shared interest in the product direction, but scope, compensation, ownership, and continuity terms need formalization.',
    dream_outcome:
      'A bounded consulting relationship with clear phase gates, payment terms, ownership language, and optional continuity paths.',
  },
  urgency_score: 7,
  opportunity_score: 8,
  sales_notes:
    'Client-safe assessment seed. Do not expose raw private conversation, prompt logs, or local file paths in client surfaces.',
}

async function findOrCreateContact(apply: boolean) {
  const { data: existing, error } = await supabaseAdmin
    .from('contact_submissions')
    .select('id')
    .or(`email.eq.${CLIENT_EMAIL},and(name.ilike.%Mark Meadows%,company.ilike.%Vanguard%)`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read Mark contact: ${error.message}`)
  if (existing?.id) return existing.id as number
  if (!apply) return 0

  const { data, error: insertError } = await supabaseAdmin
    .from('contact_submissions')
    .insert({
      name: 'Mark Meadows',
      email: CLIENT_EMAIL,
      company: 'Vanguard Enterprises',
      company_domain: 'vanguardenterprises.com',
      job_title: 'VP Engineering',
      industry: 'Engineering Services',
      lead_source: 'other',
      qualification_status: 'qualified',
      is_decision_maker: true,
      interest_areas: ['productized engineering workflow', 'CAD/CAM', 'AI-assisted manufacturing intake'],
      interest_summary:
        'Client-safe contact record for ReversR rebuild assessment and dashboard gap analysis.',
      website_tech_stack: {
        source: 'public website review',
        observed_site_type: 'legacy static business website',
        services_page: 'http://vanguardenterprises.com/services---solutions.html',
      },
    })
    .select('id')
    .single()

  if (insertError || !data?.id) {
    throw new Error(`Failed to create Mark contact: ${insertError?.message ?? 'missing id'}`)
  }

  return data.id as number
}

async function findProject() {
  const { data, error } = await supabaseAdmin
    .from('client_projects')
    .select('id, contact_submission_id')
    .or('project_name.ilike.%ReversR Rebuild%,client_name.ilike.%Mark Meadows%,client_company.ilike.%Vanguard%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) {
    throw new Error(`Failed to find Mark/ReversR project: ${error?.message ?? 'not found'}`)
  }

  return data as { id: string; contact_submission_id: number | null }
}

async function upsertAudit(contactSubmissionId: number, apply: boolean) {
  const payload = {
    ...assessmentPayload,
    contact_submission_id: contactSubmissionId,
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from('diagnostic_audits')
    .select('id')
    .eq('contact_submission_id', contactSubmissionId)
    .eq('metadata->>assessment_key', ASSESSMENT_KEY)
    .maybeSingle()

  if (readError) throw new Error(`Failed to read Mark assessment audit: ${readError.message}`)
  if (!apply) return existing?.id ?? 0

  if (existing?.id) {
    const { error } = await supabaseAdmin
      .from('diagnostic_audits')
      .update(payload)
      .eq('id', existing.id)

    if (error) throw new Error(`Failed to update Mark assessment audit: ${error.message}`)
    return existing.id as number
  }

  const { data, error } = await supabaseAdmin
    .from('diagnostic_audits')
    .insert(payload)
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create Mark assessment audit: ${error?.message ?? 'missing id'}`)
  }

  return data.id as number
}

async function upsertProjectLink(projectId: string, contactSubmissionId: number, apply: boolean) {
  if (!apply) return
  const { error } = await supabaseAdmin
    .from('client_projects')
    .update({ contact_submission_id: contactSubmissionId })
    .eq('id', projectId)

  if (error) throw new Error(`Failed to link project to Mark contact: ${error.message}`)
}

async function createScoreSnapshot(projectId: string, apply: boolean) {
  const overallScore = calculateOverallScore(categoryScores)
  const dreamOutcomeGap = calculateDreamOutcomeGap(categoryScores)
  if (!apply) return { overallScore, dreamOutcomeGap, snapshotId: 'dry-run-score-snapshot-id' }

  const { data, error } = await supabaseAdmin
    .from('score_snapshots')
    .insert({
      client_project_id: projectId,
      category_scores: categoryScores,
      overall_score: overallScore,
      dream_outcome_gap: dreamOutcomeGap,
      trigger: 'manual',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(`Failed to create Mark score snapshot: ${error?.message ?? 'missing id'}`)
  }

  return { overallScore, dreamOutcomeGap, snapshotId: data.id as string }
}

async function main() {
  const apply = args.has('--apply')
  const project = await findProject()
  const contactSubmissionId = await findOrCreateContact(apply)
  const auditId = contactSubmissionId ? await upsertAudit(contactSubmissionId, apply) : 0
  if (contactSubmissionId) {
    await upsertProjectLink(project.id, contactSubmissionId, apply)
  }
  const scoreSnapshot = await createScoreSnapshot(project.id, apply)

  console.log(JSON.stringify({
    applied: apply,
    clientProjectId: project.id,
    contactSubmissionId,
    diagnosticAuditId: auditId,
    scoreSnapshot,
    scores: categoryScores,
    source: assessmentPayload.website_url,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
