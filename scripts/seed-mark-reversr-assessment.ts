#!/usr/bin/env tsx

import { supabaseAdmin } from '@/lib/supabase'
import { calculateDreamOutcomeGap, calculateOverallScore, type CategoryScores } from '@/lib/assessment-scoring'

const args = new Set(process.argv.slice(2))

const CLIENT_EMAIL = process.env.MARK_MEADOWS_EMAIL || 'mark.meadows@offline.local'
const ASSESSMENT_KEY = 'mark-reversr-client-safe-assessment-v1'
const ROADMAP_KEY = 'mark-reversr-client-roadmap-v1'
const REVERSR_REPO_URL = 'https://github.com/vsillah/ReversR-Rebuild'
const EVIDENCE_CAPTURED_AT = '2026-06-15T12:00:00.000Z'

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

const roadmapMilestones = [
  {
    id: 'reversr-m0-internal-test-distribution',
    week: 0,
    title: 'Distribute the test app to internal testers',
    description:
      'Package and distribute the current ReversR test build so internal testers can install it and begin hands-on validation.',
    deliverables: [
      'iOS and Android tester access path',
      'Install instructions and build/version reference',
      'Known release gates and tester feedback channel',
    ],
    phase: 1,
    status: 'pending',
    evidence: [
      {
        id: 'm0-build-depth',
        source_type: 'github',
        source_label: 'GitHub repository evidence',
        summary:
          'ReversR-Rebuild repository evidence shows 149 all-branch commits, 36,775 tracked code/doc/config lines, and 38 passed release gates supporting test-build readiness.',
        confidence: 'high',
        status: 'verified',
        source_url: REVERSR_REPO_URL,
        source_ref: 'client_project_build_evidence.repo_metrics',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm0-store-testers',
        source_type: 'release_gate',
        source_label: 'Tester distribution records',
        summary:
          'Store-console tester distribution needs App Store Connect and Google Play evidence before this can be marked fully verified.',
        confidence: 'medium',
        status: 'access_needed',
        source_ref: 'app_store_connect/google_play tester groups',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'hybrid',
      status: 'access_needed',
      summary:
        'GitHub can support build and release-gate evidence; App Store Connect and Google Play access are required to automate tester distribution verification.',
      next_check: 'Connect store-console exports or API access.',
    },
  },
  {
    id: 'reversr-m1-twelve-tester-go',
    week: 1,
    title: 'Secure 12 internal tester GO decisions',
    description:
      'Confirm whether at least 12 internal testers can install, use, and approve the app as directionally ready for release.',
    deliverables: [
      '12 tester acceptances or documented blockers',
      'GO / no-GO summary',
      'Issue list prioritized for 1.0 release readiness',
    ],
    phase: 1,
    status: 'pending',
    evidence: [
      {
        id: 'm1-go-log',
        source_type: 'manual',
        source_label: 'Tester GO decision log',
        summary:
          'The 12-tester GO threshold should be verified from tester responses, survey records, or store beta feedback once testers are active.',
        confidence: 'medium',
        status: 'pending',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm1-store-feedback',
        source_type: 'google_play',
        source_label: 'Google Play / App Store beta feedback',
        summary:
          'Store beta feedback requires connected Google Play and App Store Connect access before it can become automated evidence.',
        confidence: 'medium',
        status: 'access_needed',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'hybrid',
      status: 'planned',
      summary:
        'Automate from a tester response sheet first, then replace or enrich with store beta feedback when platform access is available.',
      next_check: 'Define the tester GO response source.',
    },
  },
  {
    id: 'reversr-m2-ios-android-1-0-release',
    week: 2,
    title: 'Release ReversR 1.0 to iOS and Android',
    description:
      'Move from tester validation to public 1.0 release once store-console, review, and release-readiness gates are complete.',
    deliverables: [
      'iOS 1.0 release',
      'Android 1.0 release',
      'Client-safe release evidence and app-store links',
    ],
    phase: 1,
    status: 'pending',
    evidence: [
      {
        id: 'm2-release-gates',
        source_type: 'github',
        source_label: 'Release readiness gates',
        summary:
          'Current build evidence shows 38 release gates passed and 1 pending store-console gate before full release evidence can be claimed.',
        confidence: 'high',
        status: 'manual_review',
        source_url: REVERSR_REPO_URL,
        source_ref: 'client_project_build_evidence.repo_metrics.release_gates',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm2-store-links',
        source_type: 'app_store_connect',
        source_label: 'iOS and Android store records',
        summary:
          'Public release should be verified with App Store and Google Play listing URLs or store-console release records.',
        confidence: 'high',
        status: 'access_needed',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'hybrid',
      status: 'access_needed',
      summary:
        'GitHub can track release prep, tags, builds, and workflows; store release truth requires Apple and Google account access.',
      next_check: 'Connect App Store Connect and Google Play evidence sources.',
    },
  },
  {
    id: 'reversr-m3-generate-product-proof',
    week: 3,
    title: 'Generate a product with the app',
    description:
      'Use ReversR to generate a concrete product output that can be reviewed as proof of practical utility, not just app functionality.',
    deliverables: [
      'Selected test product/use case',
      'Generated output package',
      'Review notes on quality, manufacturability, and next-step effort',
    ],
    phase: 1,
    status: 'pending',
    evidence: [
      {
        id: 'm3-output-package',
        source_type: 'artifact',
        source_label: 'Generated product proof package',
        summary:
          'Completion should be backed by an exported app output, screenshots, review notes, and manufacturability assessment.',
        confidence: 'medium',
        status: 'pending',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'manual',
      status: 'planned',
      summary:
        'This milestone needs artifact capture from the app workflow; GitHub can store/review the proof package but cannot prove product quality alone.',
      next_check: 'Choose the test product and evidence packet format.',
    },
  },
  {
    id: 'reversr-m4-website-order-fulfillment',
    week: 4,
    title: 'Embed the app into the website and connect order fulfillment',
    description:
      'Connect the app experience to Vanguard’s web presence so users can move from app interaction into a structured order or machine-build request.',
    deliverables: [
      'Website embed or launch path',
      'Order intake workflow',
      'Fulfillment handoff requirements for Vanguard review',
    ],
    phase: 2,
    status: 'pending',
    evidence: [
      {
        id: 'm4-website-workflow',
        source_type: 'runtime_smoke',
        source_label: 'Website/order-flow smoke test',
        summary:
          'Completion should be verified by a working website path from app interaction to order or machine-build request submission.',
        confidence: 'medium',
        status: 'pending',
        source_url: 'http://vanguardenterprises.com/',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm4-repo-integration',
        source_type: 'github',
        source_label: 'Integration code evidence',
        summary:
          'GitHub can verify implementation changes once the website embed and order-flow code are committed.',
        confidence: 'medium',
        status: 'pending',
        source_url: REVERSR_REPO_URL,
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'github',
      status: 'planned',
      summary:
        'Automate verification with GitHub deployment checks plus a smoke test that submits a non-production order request.',
      next_check: 'Define the website integration target and test-safe order path.',
    },
  },
  {
    id: 'reversr-m5-local-llm-server',
    week: 5,
    title: 'Integrate a local LLM through a local server',
    description:
      'Evaluate and implement the architecture required to run AI generation locally when security, offline operation, or cost control justifies it.',
    deliverables: [
      'Local-vs-cloud architecture decision',
      'Local server prototype or implementation plan',
      'Validation criteria for AI quality, latency, hardware, and security',
    ],
    phase: 2,
    status: 'pending',
    evidence: [
      {
        id: 'm5-architecture-proof',
        source_type: 'runtime_smoke',
        source_label: 'Local AI runtime evidence',
        summary:
          'Completion should be verified by local server run evidence, model configuration, output quality checks, and latency/security notes.',
        confidence: 'medium',
        status: 'pending',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm5-github-implementation',
        source_type: 'github',
        source_label: 'Local AI implementation commits',
        summary:
          'GitHub can verify local-server implementation changes, configuration, and tests after the architecture is selected.',
        confidence: 'medium',
        status: 'pending',
        source_url: REVERSR_REPO_URL,
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'github',
      status: 'planned',
      summary:
        'Automate from local runtime smoke-test artifacts and GitHub commits; hardware/security acceptance remains a decision gate.',
      next_check: 'Decide local, cloud, or hybrid architecture for Phase 2/3.',
    },
  },
  {
    id: 'reversr-m6-client-purchase-path',
    week: 6,
    title: 'Convert clients into app purchasers',
    description:
      'Turn release, proof-of-product, website/order flow, and AI reliability into a commercial offer that customers can buy.',
    deliverables: [
      'Client purchase path',
      'Offer/pricing structure',
      'Continuity or support model for post-purchase delivery',
    ],
    phase: 2,
    status: 'pending',
    evidence: [
      {
        id: 'm6-purchase-records',
        source_type: 'stripe',
        source_label: 'Purchase/payment records',
        summary:
          'Client purchase evidence should come from the agreed checkout, invoice, or contract system after the commercial offer is finalized.',
        confidence: 'high',
        status: 'pending',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
      {
        id: 'm6-offer-path',
        source_type: 'manual',
        source_label: 'Offer and continuity model',
        summary:
          'The offer should preserve fixed-fee/value pricing while using hourly translation only as a comparison lens.',
        confidence: 'medium',
        status: 'manual_review',
        captured_at: EVIDENCE_CAPTURED_AT,
        is_client_visible: true,
      },
    ],
    automation: {
      source: 'hybrid',
      status: 'planned',
      summary:
        'Automate purchase verification from Stripe or signed-order records once the client purchase path is chosen.',
      next_check: 'Choose the commercial system of record.',
    },
  },
] as const

type RoadmapMilestoneSeed = (typeof roadmapMilestones)[number]

function milestoneHasProgressEvidence(milestone: RoadmapMilestoneSeed): boolean {
  return milestone.evidence.some((item) => item.status === 'verified')
}

function applyMilestoneProgressStatus(milestone: RoadmapMilestoneSeed) {
  return {
    ...milestone,
    status: milestoneHasProgressEvidence(milestone) ? 'in_progress' : 'pending',
  }
}

const roadmapMilestonesWithProgress = roadmapMilestones.map(applyMilestoneProgressStatus)

function hasSameCategoryScores(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const rowScores = value as Partial<Record<keyof CategoryScores, unknown>>
  return Object.entries(categoryScores).every(([key, score]) => rowScores[key as keyof CategoryScores] === score)
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

async function upsertRoadmapMilestones(projectId: string, apply: boolean) {
  const planPayload = {
    client_project_id: projectId,
    milestones: roadmapMilestonesWithProgress,
    status: 'in_progress',
    is_customized: true,
    admin_notes: `${ROADMAP_KEY}: Client-safe ReversR product roadmap milestones seeded from consultant-provided phase gates.`,
    setup_requirements: [
      {
        title: 'Tester access and store-console readiness',
        status: 'in_progress',
      },
      {
        title: 'Website/order-flow scope decision',
        status: 'pending',
      },
      {
        title: 'Local AI infrastructure decision',
        status: 'pending',
      },
    ],
    communication_plan: {
      cadence: 'Gate-based updates at each milestone',
      decision_gates: [
        '12 internal tester GO threshold',
        '1.0 release approval',
        'website/order-flow scope approval',
        'local LLM architecture approval',
        'commercial purchase-path approval',
      ],
    },
    win_conditions: [
      'Internal testers can install and validate the app.',
      '1.0 is released on iOS and Android.',
      'A product can be generated and reviewed from the app workflow.',
      'A website-connected order path exists.',
      'The AI architecture supports the agreed security and reliability posture.',
      'Clients can purchase the app or app-enabled service.',
    ],
    artifacts_handoff: [
      'App-store/tester release evidence',
      'Generated product proof package',
      'Website embed/order-flow documentation',
      'Local AI architecture notes',
      'Commercial offer/purchase path',
    ],
  }

  const { data: project, error: projectError } = await supabaseAdmin
    .from('client_projects')
    .select('onboarding_plan_id')
    .eq('id', projectId)
    .single()

  if (projectError) throw new Error(`Failed to read project onboarding link: ${projectError.message}`)
  if (!apply) return project?.onboarding_plan_id ?? 'dry-run-onboarding-plan-id'

  let planId = project?.onboarding_plan_id as string | null
  if (!planId) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('onboarding_plans')
      .select('id')
      .eq('client_project_id', projectId)
      .ilike('admin_notes', `%${ROADMAP_KEY}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingError) throw new Error(`Failed to read existing roadmap plan: ${existingError.message}`)
    planId = (existing?.id as string | undefined) ?? null
  }

  if (planId) {
    const { error } = await supabaseAdmin
      .from('onboarding_plans')
      .update(planPayload)
      .eq('id', planId)

    if (error) throw new Error(`Failed to update roadmap milestones: ${error.message}`)
  } else {
    const { data, error } = await supabaseAdmin
      .from('onboarding_plans')
      .insert(planPayload)
      .select('id')
      .single()

    if (error || !data?.id) {
      throw new Error(`Failed to create roadmap milestones: ${error?.message ?? 'missing id'}`)
    }
    planId = data.id as string
  }

  const { error: linkError } = await supabaseAdmin
    .from('client_projects')
    .update({ onboarding_plan_id: planId })
    .eq('id', projectId)

  if (linkError) throw new Error(`Failed to link roadmap milestones to project: ${linkError.message}`)
  return planId
}

async function createScoreSnapshot(projectId: string, apply: boolean) {
  const overallScore = calculateOverallScore(categoryScores)
  const dreamOutcomeGap = calculateDreamOutcomeGap(categoryScores)
  if (!apply) return { overallScore, dreamOutcomeGap, snapshotId: 'dry-run-score-snapshot-id' }

  const { data: latest, error: latestError } = await supabaseAdmin
    .from('score_snapshots')
    .select('id, category_scores, overall_score, dream_outcome_gap')
    .eq('client_project_id', projectId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) {
    throw new Error(`Failed to read latest Mark score snapshot: ${latestError.message}`)
  }

  if (
    latest &&
    hasSameCategoryScores(latest.category_scores) &&
    latest.overall_score === overallScore &&
    Number(latest.dream_outcome_gap) === dreamOutcomeGap
  ) {
    return { overallScore, dreamOutcomeGap, snapshotId: latest.id as string }
  }

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
  const onboardingPlanId = await upsertRoadmapMilestones(project.id, apply)
  const scoreSnapshot = await createScoreSnapshot(project.id, apply)

  console.log(JSON.stringify({
    applied: apply,
    clientProjectId: project.id,
    contactSubmissionId,
    diagnosticAuditId: auditId,
    onboardingPlanId,
    milestoneCount: roadmapMilestones.length,
    scoreSnapshot,
    scores: categoryScores,
    source: assessmentPayload.website_url,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
