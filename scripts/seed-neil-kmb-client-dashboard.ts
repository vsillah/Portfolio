#!/usr/bin/env tsx
/**
 * Seed the Neil/KMB client dashboard packet.
 *
 * Defaults to a dry run against dev credentials. Production must be explicit:
 *
 *   npm run client:seed-neil-kmb
 *   npm run client:seed-neil-kmb -- --target dev --apply
 *   npm run client:seed-neil-kmb:prod:dry-run
 *   npm run client:seed-neil-kmb:prod:apply
 *
 * Env:
 *   dev:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   prod: PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { promises as fs } from 'fs'
import path from 'path'

type Target = 'dev' | 'prod'

const argv = process.argv.slice(2)
const args = new Set(argv)
const apply = args.has('--apply')

function readFlag(name: string): string | null {
  const index = argv.indexOf(name)
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')) {
    return argv[index + 1]
  }
  const inline = argv.find((arg) => arg.startsWith(`${name}=`))
  return inline ? inline.slice(name.length + 1) : null
}

function resolveEnvFile() {
  return path.resolve(process.cwd(), readFlag('--env-file') || '.env.local')
}

function resolveTarget(): Target {
  const rawTarget = args.has('--prod') ? 'prod' : readFlag('--target') || 'dev'
  if (rawTarget !== 'dev' && rawTarget !== 'prod') {
    console.error(`Unsupported target "${rawTarget}". Use --target dev or --target prod.`)
    process.exit(1)
  }
  return rawTarget
}

dotenv.config({ path: resolveEnvFile(), quiet: true })

const target = resolveTarget()

const CLIENT_EMAIL = 'neil@keepmassbeautiful.org'
const CONTACT_ID = 21
const PROJECT_KEY = 'kmb-firespring-template-migration'
const DRIVE_ROOT =
  '/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Client Projects /KMB'

const documentSeeds = [
  {
    title: 'KMB Flash Consulting Brief / Original Agreement',
    fileName: 'KMB-FlashConsulting-111425.pdf',
    documentType: 'proposal_package',
    displayOrder: 0,
    alsoAttachAsProposalPdf: true,
  },
  {
    title: 'Firespring Template Comparison for KMB',
    fileName: 'Firespring-Template-Comparison-for-KMB.pdf',
    documentType: 'strategy_report',
    displayOrder: 1,
    alsoAttachAsProposalPdf: false,
  },
  {
    title: 'KMB Website UX Redesign Implementation Strategy',
    fileName: 'KMB-Website-UX-Redesign-Implementation-Strategy (1).pdf',
    documentType: 'strategy_report',
    displayOrder: 2,
    alsoAttachAsProposalPdf: false,
  },
  {
    title: 'The Cost of Standing Still: KMB Opportunity Quantification',
    fileName: 'The-Cost-of-Standing-Still-KMB-Opportunity-Quantification (2).pdf',
    documentType: 'opportunity_quantification',
    displayOrder: 3,
    alsoAttachAsProposalPdf: false,
  },
  {
    title: 'Website Redesign Primer',
    fileName: 'My-Website-Needs-a-Redesign-Where-do-I-Start.pdf',
    documentType: 'other',
    displayOrder: 4,
    alsoAttachAsProposalPdf: false,
  },
] as const

const latestReadAiMeeting = {
  id: '01KXR7SVNHSXAH801T1Z9MAMJM',
  title: 'Website Template Evaluation',
  meetingDate: '2026-07-17T14:31:03.601Z',
  durationMinutes: 18,
  reportUrl: 'https://app.read.ai/analytics/meetings/01KXR7SVNHSXAH801T1Z9MAMJM',
  summary:
    'Neil and Vambah reassessed the FireSpring Balance template path. Neil said the new template was not showing enough benefit to justify the busy work needed to recreate what the current site already does. The recommended path is to pause the template rollout, ask FireSpring to unlock the existing site, revisit the original agreement and goals, and decide whether the next paid step should be a focused existing-site fundraising improvement, a small FireSpring customization advisory path, or a separately scoped extension.',
  keyDecisions: [
    'Pause the FireSpring Balance template rollout until KMB confirms the existing-site option and original agreement scope.',
    'Ask FireSpring to unlock the existing website so near-term edits can resume on the current template.',
    'Prioritize the low-friction fundraising improvement path: stronger homepage copy, a clear donation image or band, and direct routing to the donation page.',
    'Treat additional FireSpring rounds or broader implementation work as new terms once the current paid value is exhausted.',
  ],
  actionItems: [
    {
      assignee: 'Neil Rhein',
      text: 'Ask FireSpring to unlock the existing site so edits can resume while the Balance template path is paused.',
    },
    {
      assignee: 'Neil Rhein',
      text: 'Revisit the original agreement and project goals to decide which fundraising improvements fit the current scope.',
    },
    {
      assignee: 'Vambah Sillah',
      text: 'Send the original agreement/brief, refreshed client dashboard, and walk-through materials.',
    },
    {
      assignee: 'Vambah Sillah',
      text: 'Update the dashboard next steps and payment options to reflect the decision pivot.',
    },
  ],
  openQuestions: [
    'Can FireSpring unlock the existing site quickly enough to make the current-template path practical?',
    'Which specific fundraising improvement should happen first: homepage donation band, stronger CTA copy, donation image, or direct QGIV routing?',
    'Would a small paid FireSpring customization solve the highest-value gap more efficiently than continuing a full template migration?',
    'If KMB eventually leaves FireSpring, who will own future site edits and maintenance?',
  ],
}

const milestonePlan = [
  {
    id: 'kmb-m1-proof-feedback-package',
    week: 1,
    phase: 1,
    title: 'Document Balance proof feedback and work to date',
    status: 'complete',
    description:
      'Centralize the FireSpring Balance proof feedback, original agreement/brief, visual recommendations, and account summary so KMB can see what has already been delivered.',
    deliverables: [
      'FireSpring follow-up email packet',
      'Visual recommendation examples',
      'Balance proof navigation change record',
    ],
    evidence: [
      {
        id: 'kmb-m1-email',
        source_type: 'portfolio',
        source_label: 'Portfolio correspondence record',
        source_ref: 'contact_communications',
        status: 'verified',
        confidence: 'high',
        summary:
          'Round-one FireSpring feedback and the July 2 follow-up response are logged against Neil Rhein in Portfolio.',
        captured_at: '2026-07-02T00:00:00.000Z',
        is_client_visible: true,
      },
      {
        id: 'kmb-m1-assets',
        source_type: 'google_drive',
        source_label: 'KMB Drive package',
        source_ref: 'KMB Modified Balance Wireframe Brief 2026-05-06.md',
        status: 'verified',
        confidence: 'high',
        summary:
          'The KMB Drive folder includes the modified Balance wireframe brief, template comparison, proof screenshots, and quality checklist.',
        captured_at: '2026-07-02T00:00:00.000Z',
        is_client_visible: true,
      },
    ],
  },
  {
    id: 'kmb-m2-decision-pivot-unlock-current-site',
    week: 2,
    phase: 1,
    title: 'Pause Balance rollout and unlock the existing site',
    status: 'in_progress',
    description:
      'Use the July 17 decision meeting to pause the Balance template migration and ask FireSpring to unlock the current site so practical fundraising edits can resume.',
    deliverables: [
      'FireSpring unlock request',
      'Decision note on pausing the Balance template path',
      'Existing-site edit path for near-term fundraising improvements',
    ],
    evidence: [
      {
        id: 'kmb-m2-read-ai-pivot',
        source_type: 'read_ai',
        source_label: 'July 17 Website Template Evaluation',
        source_ref: `read_ai:${latestReadAiMeeting.id}`,
        status: 'verified',
        confidence: 'high',
        summary:
          'The latest meeting concluded that the new template is not delivering enough benefit to justify recreating existing-site behavior.',
        captured_at: latestReadAiMeeting.meetingDate,
        is_client_visible: true,
      },
    ],
  },
  {
    id: 'kmb-m3-existing-site-fundraising-treatment',
    week: 2,
    phase: 2,
    title: 'Scope the existing-site fundraising improvement',
    status: 'in_progress',
    description:
      'Define a narrow current-template path for a stronger donation moment: clearer homepage copy, a better image or giving band, and direct routing to the active donation page.',
    deliverables: [
      'Homepage donor language options',
      'Existing-template implementation notes',
      'Donate link routing recommendation',
    ],
    evidence: [
      {
        id: 'kmb-m3-meeting',
        source_type: 'read_ai',
        source_label: 'June 18 KMB meeting notes',
        source_ref: 'meeting_records.ac8514f9-356b-487d-a1cc-6853f469873a',
        status: 'verified',
        confidence: 'high',
        summary:
          'The June 18 meeting captured donor CTA, sponsor/shop, QGIV donation link, and board/logo follow-up items.',
        captured_at: '2026-06-18T16:52:26.750Z',
        is_client_visible: true,
      },
    ],
  },
  {
    id: 'kmb-m4-customization-vs-platform-decision',
    week: 3,
    phase: 2,
    title: 'Compare FireSpring customization against platform change',
    status: 'pending',
    description:
      'Decide whether a small FireSpring custom feature is enough for the fundraising and navigation goals, or whether the limits point to a future platform move after maintenance ownership is clearer.',
    deliverables: [
      'Small-customization question set for FireSpring',
      'Platform constraint decision note',
      'Maintenance ownership risk note',
    ],
    evidence: [
      {
        id: 'kmb-m4-inventory',
        source_type: 'spreadsheet',
        source_label: 'KMB content inventory workbook',
        source_ref: 'kmb-content-inventory-balance.xlsx',
        status: 'verified',
        confidence: 'high',
        summary:
          'The content inventory workbook is available as the working source for page cleanup and program-depth mapping.',
        captured_at: '2026-04-05T00:00:00.000Z',
        is_client_visible: true,
      },
    ],
  },
  {
    id: 'kmb-m5-agreement-and-next-terms',
    week: 4,
    phase: 3,
    title: 'Set agreement review and next-term decision',
    status: 'pending',
    description:
      'Use the dashboard, account summary, and original agreement/brief to decide whether the next work should be no-cost handoff, a focused paid extension, or a broader implementation package.',
    deliverables: [
      'Original agreement/brief resend',
      'Account summary and services rendered walkthrough',
      'Next-term recommendation',
    ],
    evidence: [
      {
        id: 'kmb-m5-quality',
        source_type: 'google_drive',
        source_label: 'KMB quality checklist and CMS guide',
        source_ref: 'kmb-quality-checklist.docx; kmb-firespring-cms-guide.docx',
        status: 'verified',
        confidence: 'high',
        summary:
          'The KMB Drive package includes a CMS guide and quality checklist that can anchor launch readiness.',
        captured_at: '2026-07-02T00:00:00.000Z',
        is_client_visible: true,
      },
    ],
  },
]

const dashboardTasks = [
  {
    category: 'decision_pivot',
    title: 'Ask FireSpring to unlock the existing KMB site',
    description:
      'Request that FireSpring restore edit access to the current site so KMB can make targeted fundraising improvements while the Balance template rollout is paused.',
    priority: 'high',
    impact_score: 98,
    status: 'in_progress',
    due_date: '2026-07-24',
    display_order: 0,
    acceleratedBundleName: null,
    accelerated_headline:
      'Use the decision reset extension if KMB wants AmaduTown to coordinate the unlock request and next-scope recommendation.',
    accelerated_savings:
      'Keeps the next step focused on the path with the least rework before more template migration time is spent.',
  },
  {
    category: 'agreement_review',
    title: 'Review the original agreement against the new direction',
    description:
      'Compare the original Website UX Refresh scope to the July 17 decision point before committing additional rounds of FireSpring or Balance proof work.',
    priority: 'high',
    impact_score: 94,
    status: 'pending',
    due_date: '2026-07-24',
    display_order: 1,
    acceleratedBundleName: null,
    accelerated_headline:
      'Use the contract-extension option if the next round goes beyond agreement review and dashboard handoff.',
    accelerated_savings:
      'Prevents new implementation work from being absorbed into an exhausted contract value without a clear decision.',
  },
  {
    category: 'fundraising_path',
    title: 'Draft the existing-site fundraising CTA improvement',
    description:
      'Create a compact homepage improvement plan for stronger giving copy, a better donation image or section, and direct donation-page routing.',
    priority: 'high',
    impact_score: 92,
    status: 'in_progress',
    due_date: '2026-07-25',
    display_order: 2,
    acceleratedBundleName: 'Community Impact Starter',
    accelerated_headline:
      'Use the focused CTA sprint when KMB wants a low-friction improvement on the existing FireSpring site.',
    accelerated_savings:
      'Targets the highest-value fundraising issue without forcing a full template migration decision.',
  },
  {
    category: 'firespring_customization',
    title: 'Ask FireSpring whether a small custom feature solves the gap',
    description:
      'Confirm whether a limited FireSpring custom request can improve the donor CTA, homepage layout, or link treatment more efficiently than continuing the Balance migration.',
    priority: 'medium',
    impact_score: 82,
    status: 'pending',
    due_date: '2026-07-29',
    display_order: 3,
    acceleratedBundleName: 'Community Impact Starter',
    accelerated_headline:
      'Use customization advisory when a bounded FireSpring vendor request may solve the problem faster than rebuild work.',
    accelerated_savings:
      'Avoids overbuilding if FireSpring can handle one narrow high-value improvement.',
  },
  {
    category: 'maintenance_decision',
    title: 'Decide who would maintain a non-FireSpring site later',
    description:
      'Capture the maintenance risk Neil raised before recommending a future custom/AI-built website outside the FireSpring editing model.',
    priority: 'medium',
    impact_score: 70,
    status: 'pending',
    due_date: '2026-08-01',
    display_order: 4,
    acceleratedBundleName: 'Community Impact Growth',
    accelerated_headline:
      'Use growth discovery only if KMB is ready to evaluate a broader supporter-journey and platform path.',
    accelerated_savings:
      'Separates long-term platform strategy from the immediate fundraising fix.',
  },
  {
    category: 'client_decision',
    title: 'Choose the next paid path before another FireSpring work round',
    description:
      'Use the account summary, services rendered, and meeting decision record to select a scoped extension, no-cost handoff, or broader package.',
    priority: 'medium',
    impact_score: 76,
    status: 'pending',
    due_date: '2026-08-01',
    display_order: 5,
    acceleratedBundleName: null,
  },
] as const

const packageRecommendationSeeds = [
  {
    bundleName: null,
    service_title: 'Decision Reset Extension',
    gap_category: 'budget_timeline',
    gap_description:
      'Highest-confidence next step when KMB wants to pause the Balance rollout, unlock the existing site, review the original agreement, and decide what still fits.',
    projected_impact_pct: 34,
    projected_annual_value: 650,
    impact_headline:
      'Recommended next phase: a compact decision reset before more implementation work.',
    impact_explanation:
      'This option keeps the next move small: document the pivot, review the agreement and dashboard, coordinate the FireSpring unlock path, and produce a go/no-go recommendation for any paid extension.',
    data_source: 'client_specific',
    confidence_level: 'high',
    cta_type: 'view_proposal',
    cta_url: '#account-summary',
    content_type: 'contract_option',
    display_order: 0,
  },
  {
    bundleName: 'Community Impact Starter',
    content_type: 'bundle',
    service_title: 'Existing Site Fundraising CTA Sprint',
    gap_category: 'automation_needs',
    gap_description:
      'Best fit if FireSpring unlocks the existing site and KMB wants the strongest low-friction fundraising improvement without continuing the full template migration.',
    projected_impact_pct: 30,
    projected_annual_value: 1200,
    impact_headline:
      'A focused current-site sprint for the donation message, visual treatment, and direct giving path.',
    impact_explanation:
      'This option targets the specific issue Neil raised: the site can likely support a stronger fundraising call to action without recreating the entire website in the Balance template.',
    data_source: 'client_specific',
    confidence_level: 'high',
    cta_type: 'view_proposal',
    cta_url: '#account-summary',
    display_order: 1,
  },
  {
    bundleName: null,
    content_type: 'contract_option',
    service_title: 'FireSpring Customization Advisory',
    gap_category: 'tech_stack',
    gap_description:
      'Best fit if KMB wants to test whether a small paid FireSpring customization can solve the homepage or donor-flow gap more efficiently than a larger redesign.',
    projected_impact_pct: 24,
    projected_annual_value: 1997,
    impact_headline:
      'A vendor-facing advisory path before paying for broader migration or platform work.',
    impact_explanation:
      'This option creates a narrow FireSpring question set and evaluation packet so KMB can compare a small custom enhancement against continued Balance-template work.',
    data_source: 'client_specific',
    confidence_level: 'medium',
    cta_type: 'view_proposal',
    cta_url: '#account-summary',
    display_order: 2,
  },
  {
    bundleName: 'Community Impact Growth',
    content_type: 'bundle',
    service_title: 'Platform Modernization Discovery',
    gap_category: 'automation_needs',
    gap_description:
      'Best fit later, if KMB decides FireSpring limits are blocking growth and has a realistic maintenance plan for a site outside the current CMS.',
    projected_impact_pct: 18,
    projected_annual_value: 4997,
    impact_headline:
      'A future-facing platform path, not the first recommendation for this decision point.',
    impact_explanation:
      'This should wait until KMB resolves ownership and editability concerns. It can become the right path if the organization wants supporter journeys, campaign readiness, and future flexibility beyond FireSpring.',
    data_source: 'client_specific',
    confidence_level: 'low',
    cta_type: 'book_call',
    cta_url: null,
    display_order: 3,
  },
] as const

const scoreSnapshot = {
  category_scores: {
    business_challenges: 78,
    tech_stack: 52,
    automation_needs: 44,
    ai_readiness: 36,
    budget_timeline: 62,
    decision_making: 68,
  },
  overall_score: 57,
  dream_outcome_gap: 43,
  trigger: 'manual',
}

type DashboardTaskSeed = (typeof dashboardTasks)[number]
type BundleRef = { id: string; pricingTierSlug: string | null }

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function envName(baseName: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY') {
  if (target === 'prod') {
    return baseName === 'SUPABASE_URL' ? 'PROD_SUPABASE_URL' : 'PROD_SUPABASE_SERVICE_ROLE_KEY'
  }
  return baseName === 'SUPABASE_URL' ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY'
}

function supabaseUrl() {
  return requiredEnv(envName('SUPABASE_URL'))
}

function serviceRoleKey() {
  return requiredEnv(envName('SUPABASE_SERVICE_ROLE_KEY'))
}

function supabase() {
  return createClient(
    supabaseUrl(),
    serviceRoleKey(),
    { auth: { persistSession: false } }
  )
}

function slugFile(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function resolveBundleIds(client: ReturnType<typeof supabase>, bundleNames: readonly string[]) {
  const uniqueNames = [...new Set(bundleNames.filter(Boolean))]
  if (!apply) {
    return new Map(uniqueNames.map((name) => [name, {
      id: `dry-run-bundle-${slugFile(name)}`,
      pricingTierSlug: slugFile(name),
    } satisfies BundleRef]))
  }

  const { data, error } = await client
    .from('offer_bundles')
    .select('id, name, pricing_tier_slug')
    .in('name', uniqueNames)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to read offer bundles for KMB package options: ${error.message}`)

  const bundleIds = new Map<string, BundleRef>()
  for (const row of data || []) {
    bundleIds.set(String(row.name), {
      id: String(row.id),
      pricingTierSlug: row.pricing_tier_slug ? String(row.pricing_tier_slug) : null,
    })
  }

  const missing = uniqueNames.filter((name) => !bundleIds.has(name))
  if (missing.length > 0) {
    throw new Error(`Missing active offer bundles for KMB package options: ${missing.join(', ')}`)
  }

  return bundleIds
}

function buildDashboardTaskPayload(task: DashboardTaskSeed, bundleIds: Map<string, BundleRef>) {
  const { acceleratedBundleName, ...taskPayload } = task

  return {
    ...taskPayload,
    diy_resources: [],
    accelerated_bundle_id: acceleratedBundleName ? bundleIds.get(acceleratedBundleName)?.id : null,
  }
}

async function ensureContact(client: ReturnType<typeof supabase>) {
  const { data: existing, error } = await client
    .from('contact_submissions')
    .select('id')
    .eq('email', CLIENT_EMAIL)
    .maybeSingle()

  if (error) throw new Error(`Failed to read Neil contact: ${error.message}`)
  if (existing?.id) return existing.id as number
  if (!apply) return CONTACT_ID

  const { data, error: insertError } = await client
    .from('contact_submissions')
    .insert({
      name: 'Neil Rhein',
      email: CLIENT_EMAIL,
      company: 'Keep Massachusetts Beautiful',
      industry: 'Nonprofit',
      lead_source: 'referral',
      qualification_status: 'qualified',
      interest_summary:
        'KMB FireSpring website template migration and Balance proof-site feedback coordination.',
    })
    .select('id')
    .single()

  if (insertError || !data?.id) {
    throw new Error(`Failed to create Neil contact: ${insertError?.message ?? 'missing id'}`)
  }

  return data.id as number
}

async function ensureProject(client: ReturnType<typeof supabase>, contactSubmissionId: number) {
  const projectPayload = {
    project_name: 'KMB FireSpring Website Decision Reset',
    description:
      'Client dashboard for Keep Massachusetts Beautiful FireSpring decision reset, original agreement review, services rendered, and existing-site fundraising next steps.',
    client_name: 'Neil Rhein',
    client_email: CLIENT_EMAIL,
    client_company: 'Keep Massachusetts Beautiful',
    contact_submission_id: contactSubmissionId,
    project_start_date: '2026-04-07',
    estimated_end_date: '2026-08-14',
    project_status: 'active',
    current_phase: 3,
    project_value: 0,
    currency: 'USD',
    notes: `${PROJECT_KEY}: July 17 Read.ai meeting pivot; pause Balance rollout, unlock the existing site, and scope any additional FireSpring or fundraising work as a separate decision.`,
  }

  const { data: existing, error } = await client
    .from('client_projects')
    .select('id, proposal_id, onboarding_plan_id')
    .or(`client_email.eq.${CLIENT_EMAIL},project_name.ilike.%KMB FireSpring%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read KMB project: ${error.message}`)
  if (!apply) return existing ?? { id: 'dry-run-client-project-id', proposal_id: null, onboarding_plan_id: null }

  if (existing?.id) {
    const { error: updateError } = await client
      .from('client_projects')
      .update(projectPayload)
      .eq('id', existing.id)

    if (updateError) throw new Error(`Failed to update KMB project: ${updateError.message}`)
    return existing as { id: string; proposal_id: string | null; onboarding_plan_id: string | null }
  }

  const { data, error: insertError } = await client
    .from('client_projects')
    .insert(projectPayload)
    .select('id, proposal_id, onboarding_plan_id')
    .single()

  if (insertError || !data?.id) {
    throw new Error(`Failed to create KMB project: ${insertError?.message ?? 'missing id'}`)
  }

  return data as { id: string; proposal_id: string | null; onboarding_plan_id: string | null }
}

async function ensureDashboardAccess(client: ReturnType<typeof supabase>, projectId: string) {
  if (!apply && projectId === 'dry-run-client-project-id') return 'dry-run-dashboard-token'

  const { data: existing, error } = await client
    .from('client_dashboard_access')
    .select('access_token')
    .eq('client_project_id', projectId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw new Error(`Failed to read dashboard token: ${error.message}`)
  if (existing?.access_token) return existing.access_token as string
  if (!apply) return 'dry-run-dashboard-token'

  const { data, error: insertError } = await client
    .from('client_dashboard_access')
    .insert({
      client_project_id: projectId,
      client_email: CLIENT_EMAIL,
    })
    .select('access_token')
    .single()

  if (insertError || !data?.access_token) {
    throw new Error(`Failed to create dashboard token: ${insertError?.message ?? 'missing token'}`)
  }

  return data.access_token as string
}

async function ensureProposal(client: ReturnType<typeof supabase>, projectId: string) {
  const proposalPayload = {
    client_name: 'Neil Rhein',
    client_email: CLIENT_EMAIL,
    client_company: 'Keep Massachusetts Beautiful',
    bundle_name: 'KMB FireSpring Decision Reset Packet',
    line_items: [
      {
        name: 'FireSpring decision reset and fundraising next-step advisory',
        description:
          'Original agreement review, Balance proof decision record, existing-site fundraising option, FireSpring customization question set, and next-term recommendation.',
        quantity: 1,
        price: 0,
      },
    ],
    subtotal: 0,
    discount_amount: 0,
    discount_description: null,
    total_amount: 0,
    terms_text:
      'Internal client record packet for KMB FireSpring decision reset support. Not a payment request; additional implementation work should be separately approved.',
    valid_until: '2026-08-15T00:00:00.000Z',
    status: 'sent',
    service_term_months: null,
  }

  const { data: existing, error } = await client
    .from('proposals')
    .select('id')
    .eq('client_email', CLIENT_EMAIL)
    .eq('bundle_name', proposalPayload.bundle_name)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read KMB proposal packet: ${error.message}`)
  if (!apply) return existing?.id ?? 'dry-run-proposal-id'

  let proposalId = existing?.id as string | undefined
  if (proposalId) {
    const { error: updateError } = await client
      .from('proposals')
      .update(proposalPayload)
      .eq('id', proposalId)

    if (updateError) throw new Error(`Failed to update KMB proposal packet: ${updateError.message}`)
  } else {
    const { data, error: insertError } = await client
      .from('proposals')
      .insert(proposalPayload)
      .select('id')
      .single()

    if (insertError || !data?.id) {
      throw new Error(`Failed to create KMB proposal packet: ${insertError?.message ?? 'missing id'}`)
    }
    proposalId = data.id as string
  }

  const { error: linkError } = await client
    .from('client_projects')
    .update({ proposal_id: proposalId })
    .eq('id', projectId)

  if (linkError) throw new Error(`Failed to link KMB proposal packet: ${linkError.message}`)
  return proposalId
}

async function uploadDocuments(client: ReturnType<typeof supabase>, proposalId: string) {
  if (!apply || proposalId === 'dry-run-proposal-id') return documentSeeds.map((doc) => doc.title)

  for (const doc of documentSeeds) {
    const sourcePath = path.join(DRIVE_ROOT, doc.fileName)
    await fs.access(sourcePath)
    const fileBuffer = await fs.readFile(sourcePath)
    const storagePath = `proposal-docs/${proposalId}/${String(doc.displayOrder).padStart(2, '0')}-${slugFile(doc.fileName)}.pdf`

    const { error: uploadError } = await client.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw new Error(`Failed to upload ${doc.fileName}: ${uploadError.message}`)

    if (doc.alsoAttachAsProposalPdf) {
      const proposalPath = `proposals/${proposalId}.pdf`
      const { error: proposalUploadError } = await client.storage
        .from('documents')
        .upload(proposalPath, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (proposalUploadError) {
        throw new Error(`Failed to upload proposal PDF ${doc.fileName}: ${proposalUploadError.message}`)
      }
      const { data: publicUrl } = client.storage.from('documents').getPublicUrl(proposalPath)
      const { error: proposalUpdateError } = await client
        .from('proposals')
        .update({ pdf_url: publicUrl.publicUrl })
        .eq('id', proposalId)
      if (proposalUpdateError) {
        throw new Error(`Failed to attach proposal PDF URL: ${proposalUpdateError.message}`)
      }
    }

    const { data: existing, error: readError } = await client
      .from('proposal_documents')
      .select('id')
      .eq('proposal_id', proposalId)
      .eq('title', doc.title)
      .maybeSingle()

    if (readError) throw new Error(`Failed to read proposal document ${doc.title}: ${readError.message}`)

    const payload = {
      proposal_id: proposalId,
      document_type: doc.documentType,
      title: doc.title,
      file_path: storagePath,
      display_order: doc.displayOrder,
      source: 'uploaded',
    }

    if (existing?.id) {
      const { error: updateError } = await client
        .from('proposal_documents')
        .update(payload)
        .eq('id', existing.id)
      if (updateError) throw new Error(`Failed to update proposal document ${doc.title}: ${updateError.message}`)
    } else {
      const { error: insertError } = await client.from('proposal_documents').insert(payload)
      if (insertError) throw new Error(`Failed to create proposal document ${doc.title}: ${insertError.message}`)
    }
  }

  return documentSeeds.map((doc) => doc.title)
}

async function upsertOnboardingPlan(client: ReturnType<typeof supabase>, projectId: string) {
  const payload = {
    client_project_id: projectId,
    milestones: milestonePlan,
    status: 'in_progress',
    is_customized: true,
    admin_notes: `${PROJECT_KEY}: KMB FireSpring decision reset milestone plan seeded from Neil Rhein correspondence, July 17 Read.ai meeting notes, and KMB Drive source package.`,
    setup_requirements: [
      { title: 'FireSpring unlocks the existing KMB site for current-template edits', status: 'pending' },
      { title: 'Neil reviews the original agreement/brief against the new direction', status: 'pending' },
      { title: 'KMB chooses whether next work is no-cost handoff, focused extension, or broader package', status: 'pending' },
    ],
    communication_plan: {
      cadence: 'Use the July 17 decision reset as the current anchor; gate any next implementation work on FireSpring unlock status and explicit next-term approval.',
      primary_contact: 'Neil Rhein',
      channels: ['Gmail', 'Portfolio client dashboard', 'Read.ai meeting imports'],
    },
    win_conditions: [
      'KMB has a clear record of the work delivered against the original agreement/brief.',
      'FireSpring unlocks the existing site or gives a clear constraint that shapes the next decision.',
      'The next fundraising improvement is scoped narrowly enough to execute without unnecessary migration rework.',
      'Any further FireSpring rounds, customization advisory, or platform discovery are approved under explicit new terms.',
    ],
    artifacts_handoff: [
      'Original agreement/brief',
      'July 17 Read.ai decision summary and action items',
      'Template comparison and Balance recommendation examples',
      'Account summary with services rendered and source links',
      'Existing-site fundraising CTA recommendation',
      'Next-term decision register',
    ],
  }

  if (!apply) return 'dry-run-onboarding-plan-id'

  const { data: existing, error } = await client
    .from('onboarding_plans')
    .select('id')
    .eq('client_project_id', projectId)
    .ilike('admin_notes', `%${PROJECT_KEY}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read KMB onboarding plan: ${error.message}`)

  let planId = existing?.id as string | undefined
  if (planId) {
    const { error: updateError } = await client
      .from('onboarding_plans')
      .update(payload)
      .eq('id', planId)
    if (updateError) throw new Error(`Failed to update KMB onboarding plan: ${updateError.message}`)
  } else {
    const { data, error: insertError } = await client
      .from('onboarding_plans')
      .insert(payload)
      .select('id')
      .single()
    if (insertError || !data?.id) {
      throw new Error(`Failed to create KMB onboarding plan: ${insertError?.message ?? 'missing id'}`)
    }
    planId = data.id as string
  }

  const { error: linkError } = await client
    .from('client_projects')
    .update({ onboarding_plan_id: planId })
    .eq('id', projectId)
  if (linkError) throw new Error(`Failed to link KMB onboarding plan: ${linkError.message}`)

  return planId
}

async function refreshDashboardTasks(client: ReturnType<typeof supabase>, projectId: string) {
  const taskCategoriesToRefresh = [
    ...new Set([
      ...dashboardTasks.map((task) => task.category),
      'firespring_feedback',
      'donation_support',
      'support_navigation',
      'client_decision',
    ]),
  ]
  const bundleIds = await resolveBundleIds(
    client,
    dashboardTasks.flatMap((task) => task.acceleratedBundleName ? [task.acceleratedBundleName] : [])
  )
  const taskPayload = dashboardTasks.map((task) => buildDashboardTaskPayload(task, bundleIds))

  if (!apply) return taskPayload.length

  const { error: deleteError } = await client
    .from('dashboard_tasks')
    .delete()
    .eq('client_project_id', projectId)
    .in('category', taskCategoriesToRefresh)

  if (deleteError) throw new Error(`Failed to clear old KMB dashboard tasks: ${deleteError.message}`)

  const { error: insertError } = await client.from('dashboard_tasks').insert(
    taskPayload.map((task) => ({
      client_project_id: projectId,
      ...task,
    }))
  )

  if (insertError) throw new Error(`Failed to insert KMB dashboard tasks: ${insertError.message}`)
  return taskPayload.length
}

async function refreshAccelerationRecommendations(client: ReturnType<typeof supabase>, projectId: string) {
  const bundleNames = packageRecommendationSeeds.flatMap((recommendation) =>
    recommendation.bundleName ? [recommendation.bundleName] : []
  )
  const bundleIds = await resolveBundleIds(
    client,
    bundleNames
  )
  const recommendationPayload = packageRecommendationSeeds.map((recommendation) => {
    const { bundleName, cta_url, content_type, ...payload } = recommendation
    if (bundleName && !bundleIds.has(bundleName)) {
      throw new Error(`Missing active offer bundle for KMB package option: ${bundleName}`)
    }

    return {
      client_project_id: projectId,
      pain_point_category_id: null,
      content_type: content_type || 'bundle',
      content_id: 0,
      benchmark_ids: [],
      value_calculation_id: null,
      is_active: true,
      dismissed_at: null,
      converted_at: null,
      cta_url: cta_url || (bundleName ? `/pricing#${bundleIds.get(bundleName)?.pricingTierSlug || slugFile(bundleName)}` : null),
      ...payload,
    }
  })

  if (!apply) return recommendationPayload.length

  const { error: deleteError } = await client
    .from('acceleration_recommendations')
    .delete()
    .eq('client_project_id', projectId)
    .is('dismissed_at', null)
    .is('converted_at', null)

  if (deleteError) throw new Error(`Failed to clear KMB package options: ${deleteError.message}`)

  const { error: insertError } = await client
    .from('acceleration_recommendations')
    .insert(recommendationPayload)

  if (insertError) throw new Error(`Failed to insert KMB package options: ${insertError.message}`)
  return recommendationPayload.length
}

async function deactivateConvertedRecommendations(client: ReturnType<typeof supabase>, projectId: string) {
  if (!apply) return 0

  const { data, error } = await client
    .from('acceleration_recommendations')
    .update({ is_active: false })
    .eq('client_project_id', projectId)
    .eq('is_active', true)
    .not('converted_at', 'is', null)
    .select('id')

  if (error) throw new Error(`Failed to deactivate converted KMB package options: ${error.message}`)
  return data?.length ?? 0
}

async function refreshScoreSnapshot(client: ReturnType<typeof supabase>, projectId: string) {
  if (!apply) return 'dry-run-score-snapshot-id'

  const { data: latest, error } = await client
    .from('score_snapshots')
    .select('id, category_scores, overall_score, dream_outcome_gap')
    .eq('client_project_id', projectId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to read KMB score snapshot: ${error.message}`)

  const sameScores = JSON.stringify(latest?.category_scores ?? {}) === JSON.stringify(scoreSnapshot.category_scores)
  if (
    latest?.id &&
    sameScores &&
    latest.overall_score === scoreSnapshot.overall_score &&
    Number(latest.dream_outcome_gap) === scoreSnapshot.dream_outcome_gap
  ) {
    return latest.id as string
  }

  const { data, error: insertError } = await client
    .from('score_snapshots')
    .insert({
      client_project_id: projectId,
      ...scoreSnapshot,
    })
    .select('id')
    .single()

  if (insertError || !data?.id) {
    throw new Error(`Failed to create KMB score snapshot: ${insertError?.message ?? 'missing id'}`)
  }

  return data.id as string
}

async function linkMeetingsAndActions(client: ReturnType<typeof supabase>, projectId: string, contactSubmissionId: number) {
  if (!apply) return

  const { error: meetingError } = await client
    .from('meeting_records')
    .update({ client_project_id: projectId })
    .eq('contact_submission_id', contactSubmissionId)

  if (meetingError) throw new Error(`Failed to link KMB meetings: ${meetingError.message}`)

  const { error: taskError } = await client
    .from('meeting_action_tasks')
    .update({ client_project_id: projectId })
    .eq('contact_submission_id', contactSubmissionId)

  if (taskError) throw new Error(`Failed to link KMB meeting action tasks: ${taskError.message}`)
}

async function upsertLatestMeetingRecord(
  client: ReturnType<typeof supabase>,
  projectId: string,
  contactSubmissionId: number
) {
  const payload = {
    contact_submission_id: contactSubmissionId,
    client_project_id: projectId,
    read_ai_meeting_id: latestReadAiMeeting.id,
    meeting_type: 'progress_checkin',
    meeting_date: latestReadAiMeeting.meetingDate,
    duration_minutes: latestReadAiMeeting.durationMinutes,
    transcript: null,
    raw_notes: latestReadAiMeeting.summary,
    structured_notes: {
      title: latestReadAiMeeting.title,
      source: 'read_ai',
      summary: latestReadAiMeeting.summary,
      report_url: latestReadAiMeeting.reportUrl,
      client_visible: true,
      guidance:
        'Client-safe decision summary only; raw transcript is not displayed on the dashboard.',
    },
    key_decisions: latestReadAiMeeting.keyDecisions,
    action_items: latestReadAiMeeting.actionItems.map((item) => ({
      owner: item.assignee,
      task: item.text,
      status: item.assignee === 'Vambah Sillah' ? 'done' : 'pending',
    })),
    open_questions: latestReadAiMeeting.openQuestions,
    meeting_data: {
      read_ai_meeting_id: latestReadAiMeeting.id,
      report_url: latestReadAiMeeting.reportUrl,
      dashboard_seed: PROJECT_KEY,
      pivot: 'pause_balance_rollout_unlock_existing_site',
    },
    attendees: [
      { name: 'Neil Rhein', email: CLIENT_EMAIL, attended: true },
      { name: 'Vambah Sillah', email: 'vsillah@gmail.com', attended: true },
    ],
    is_test_data: false,
  }

  if (!apply) return 'dry-run-latest-meeting-record-id'

  const { data: existing, error } = await client
    .from('meeting_records')
    .select('id')
    .eq('read_ai_meeting_id', latestReadAiMeeting.id)
    .maybeSingle()

  if (error) throw new Error(`Failed to read latest KMB meeting record: ${error.message}`)

  if (existing?.id) {
    const { data, error: updateError } = await client
      .from('meeting_records')
      .update(payload)
      .eq('id', existing.id)
      .select('id')
      .single()

    if (updateError || !data?.id) {
      throw new Error(`Failed to update latest KMB meeting record: ${updateError?.message ?? 'missing id'}`)
    }
    return data.id as string
  }

  const { data, error: insertError } = await client
    .from('meeting_records')
    .insert(payload)
    .select('id')
    .single()

  if (insertError || !data?.id) {
    throw new Error(`Failed to create latest KMB meeting record: ${insertError?.message ?? 'missing id'}`)
  }

  return data.id as string
}

async function seedTimeEntries(client: ReturnType<typeof supabase>, projectId: string) {
  const entries = [
    {
      target_id: '0',
      description: 'FireSpring proof review, vendor recommendation research, and feedback synthesis',
      duration_seconds: 7200,
      started_at: '2026-05-06T14:00:00.000Z',
      stopped_at: '2026-05-06T16:00:00.000Z',
    },
    {
      target_id: '0',
      description: 'KMB Balance wireframe examples, visual recommendation package, and presentation support',
      duration_seconds: 10800,
      started_at: '2026-06-18T18:00:00.000Z',
      stopped_at: '2026-06-18T21:00:00.000Z',
    },
    {
      target_id: '0',
      description: 'Neil follow-up email drafting, Gmail send, and Portfolio correspondence reconciliation',
      duration_seconds: 5400,
      started_at: '2026-07-02T03:00:00.000Z',
      stopped_at: '2026-07-02T04:30:00.000Z',
    },
    {
      target_id: '1',
      description: 'July 17 decision reset meeting review, dashboard pivot update, and next-term recommendation',
      duration_seconds: 5400,
      started_at: '2026-07-17T14:31:03.601Z',
      stopped_at: '2026-07-17T16:01:03.601Z',
    },
  ]

  if (!apply) return entries.length

  const { error: deleteError } = await client
    .from('time_entries')
    .delete()
    .eq('client_project_id', projectId)
    .like('description', 'KMB dashboard seed:%')

  if (deleteError) throw new Error(`Failed to clear KMB time entries: ${deleteError.message}`)

  const { error: insertError } = await client.from('time_entries').insert(
    entries.map((entry) => ({
      client_project_id: projectId,
      target_type: 'milestone',
      target_id: entry.target_id,
      description: `KMB dashboard seed: ${entry.description}`,
      duration_seconds: entry.duration_seconds,
      started_at: entry.started_at,
      stopped_at: entry.stopped_at,
      is_running: false,
    }))
  )

  if (insertError) throw new Error(`Failed to seed KMB time entries: ${insertError.message}`)
  return entries.length
}

async function main() {
  const targetUrl = supabaseUrl()
  const targetHost = new URL(targetUrl).hostname
  console.log(`Target: ${target.toUpperCase()} (${targetHost})`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Env file: ${resolveEnvFile()}`)

  const client = supabase()
  const contactSubmissionId = await ensureContact(client)
  const project = await ensureProject(client, contactSubmissionId)
  const dashboardToken = await ensureDashboardAccess(client, project.id)
  const proposalId = await ensureProposal(client, project.id)
  const documents = await uploadDocuments(client, proposalId)
  const onboardingPlanId = await upsertOnboardingPlan(client, project.id)
  const taskCount = await refreshDashboardTasks(client, project.id)
  const packageOptionCount = await refreshAccelerationRecommendations(client, project.id)
  const convertedRecommendationDeactivatedCount = await deactivateConvertedRecommendations(client, project.id)
  const scoreSnapshotId = await refreshScoreSnapshot(client, project.id)
  await linkMeetingsAndActions(client, project.id, contactSubmissionId)
  const latestMeetingRecordId = await upsertLatestMeetingRecord(client, project.id, contactSubmissionId)
  const timeEntryCount = await seedTimeEntries(client, project.id)

  console.log(
    JSON.stringify(
      {
        applied: apply,
        target,
        targetHost,
        clientProjectId: project.id,
        contactSubmissionId,
        proposalId,
        onboardingPlanId,
        dashboardAccess: dashboardToken ? 'created-or-reused' : 'not-created',
        documents,
        milestoneCount: milestonePlan.length,
        dashboardTaskCount: taskCount,
        packageOptionCount,
        convertedRecommendationDeactivatedCount,
        scoreSnapshotId,
        latestMeetingRecordId,
        timeEntryCount,
        correspondence: {
          contactCommunications: 'linked through contact_submission_id',
          meetingRecords: 'linked to client_project_id when --apply is used',
          meetingActionTasks: 'linked to client_project_id when --apply is used',
        },
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
