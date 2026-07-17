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
    title: 'KMB Flash Consulting Brief',
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

const milestonePlan = [
  {
    id: 'kmb-m1-proof-feedback-package',
    week: 1,
    phase: 1,
    title: 'Consolidate Balance proof feedback',
    status: 'in_progress',
    description:
      'Centralize the FireSpring Balance proof feedback, including typography, border/shadow treatment, navigation depth, donor CTA treatment, and homepage section recommendations.',
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
    id: 'kmb-m2-vendor-navigation-answer',
    week: 2,
    phase: 1,
    title: 'Resolve FireSpring internal navigation pattern',
    status: 'pending',
    description:
      'Get FireSpring to confirm whether Balance supports breadcrumbs, sidebar navigation, sticky subnavigation, or a supported section-depth workaround.',
    deliverables: [
      'FireSpring answer on internal navigation support',
      'Decision on Balance template viability',
      'Fallback pattern for program interior pages',
    ],
    evidence: [
      {
        id: 'kmb-m2-question',
        source_type: 'email',
        source_label: 'Neil Rhein website statistics thread',
        source_ref: 'contact_communications: FW: Your Monthly Website Statistics Are Ready! - June 2026',
        status: 'manual_review',
        confidence: 'high',
        summary:
          'Neil flagged that high-traffic program pages need clearer orientation than a top navigation alone.',
        captured_at: '2026-07-02T00:00:00.000Z',
        is_client_visible: true,
      },
    ],
  },
  {
    id: 'kmb-m3-donor-and-support-treatment',
    week: 2,
    phase: 2,
    title: 'Tighten giving and support treatment',
    status: 'in_progress',
    description:
      'Draft a stronger first giving band, make donation paths direct, and bring sponsor/shop actions into the main Support pathway without crowding the homepage.',
    deliverables: [
      'Homepage donor language options',
      'Donate link routing recommendation',
      'Support navigation notes for sponsor and shop actions',
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
    id: 'kmb-m4-content-inventory-and-section-depth',
    week: 3,
    phase: 2,
    title: 'Map content inventory to section-depth decisions',
    status: 'pending',
    description:
      'Use the content inventory and monthly stats to decide which program pages need local section links, cleanup, consolidation, or prominent homepage routing.',
    deliverables: [
      'Priority page map',
      'Program section navigation model',
      'Content cleanup list for KMB team edits',
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
    id: 'kmb-m5-launch-readiness-handoff',
    week: 4,
    phase: 3,
    title: 'Prepare launch-readiness and CMS handoff checklist',
    status: 'pending',
    description:
      'Turn the quality checklist and CMS guide into a practical handoff path for the KMB team after FireSpring confirms the template constraints.',
    deliverables: [
      'Quality checklist review',
      'CMS guide handoff',
      'Launch decision register',
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
    category: 'firespring_feedback',
    title: 'Ask FireSpring for their supported internal-navigation pattern',
    description:
      'Confirm whether Balance supports breadcrumbs, sidebar navigation, sticky subnavigation, or another recommended section-depth pattern.',
    priority: 'high',
    impact_score: 95,
    status: 'pending',
    due_date: '2026-07-15',
    display_order: 0,
  },
  {
    category: 'firespring_feedback',
    title: 'Call out the Balance proof navigation reorder so it is not reverted',
    description:
      'Preserve the proof-site navigation adjustment already made during the first feedback pass.',
    priority: 'high',
    impact_score: 90,
    status: 'in_progress',
    due_date: '2026-07-15',
    display_order: 1,
  },
  {
    category: 'donation_support',
    title: 'Draft the stronger first giving band treatment',
    description:
      'Create homepage donor language that makes the reason to give concrete before asking visitors to act.',
    priority: 'high',
    impact_score: 88,
    status: 'in_progress',
    due_date: '2026-07-16',
    display_order: 2,
  },
  {
    category: 'donation_support',
    title: 'Route Donate links directly to the QGIV donation page',
    description:
      'Avoid extra friction by sending donation CTAs to the active Blue Meringue/QGIV giving flow.',
    priority: 'medium',
    impact_score: 78,
    status: 'pending',
    due_date: '2026-07-17',
    display_order: 3,
  },
  {
    category: 'support_navigation',
    title: 'Add sponsor and shop actions into the Support pathway',
    description:
      'Bring Become a Sponsor and Shop into the Support navigation without making the top-level navigation feel crowded.',
    priority: 'medium',
    impact_score: 72,
    status: 'pending',
    due_date: '2026-07-17',
    display_order: 4,
  },
  {
    category: 'client_decision',
    title: 'Neil to take logo concepts to the KMB board',
    description:
      'Keep board feedback tracked separately from the website template feedback so launch decisions do not get tangled.',
    priority: 'medium',
    impact_score: 65,
    status: 'pending',
    due_date: '2026-07-24',
    display_order: 5,
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
    project_name: 'KMB FireSpring Website Template Migration',
    description:
      'Client dashboard for Keep Massachusetts Beautiful FireSpring Balance proof review, correspondence, milestones, and website migration assets.',
    client_name: 'Neil Rhein',
    client_email: CLIENT_EMAIL,
    client_company: 'Keep Massachusetts Beautiful',
    contact_submission_id: contactSubmissionId,
    project_start_date: '2026-04-07',
    estimated_end_date: '2026-08-14',
    project_status: 'active',
    current_phase: 2,
    project_value: 0,
    currency: 'USD',
    notes: `${PROJECT_KEY}: FireSpring Balance template migration, proof-site feedback, and KMB content/navigation cleanup.`,
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
    bundle_name: 'KMB FireSpring Migration Working Packet',
    line_items: [
      {
        name: 'FireSpring Balance proof feedback and migration advisory',
        description:
          'Template-fit recommendations, navigation-depth decision support, donor CTA treatment, and launch-readiness handoff assets.',
        quantity: 1,
        price: 0,
      },
    ],
    subtotal: 0,
    discount_amount: 0,
    discount_description: null,
    total_amount: 0,
    terms_text:
      'Internal client record packet for KMB FireSpring website migration support. Not a payment request.',
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
    admin_notes: `${PROJECT_KEY}: KMB FireSpring Balance migration milestone plan seeded from Neil Rhein correspondence, Read.ai meeting notes, and KMB Drive source package.`,
    setup_requirements: [
      { title: 'FireSpring support answer for internal navigation depth', status: 'pending' },
      { title: 'KMB board feedback on logo concepts', status: 'pending' },
      { title: 'QGIV/Blue Meringue donation URL confirmation', status: 'pending' },
    ],
    communication_plan: {
      cadence: 'Restart the week of July 13, 2026 after vacation; then gate updates around FireSpring responses and KMB decisions.',
      primary_contact: 'Neil Rhein',
      channels: ['Gmail', 'Portfolio client dashboard', 'Read.ai meeting imports'],
    },
    win_conditions: [
      'FireSpring confirms the supported pattern for section-depth navigation.',
      'The Balance proof preserves the approved top-navigation reorder.',
      'Homepage donor/support treatment is strong enough to orient visitors before the ask.',
      'High-traffic program pages have an agreed way to keep visitors oriented.',
      'KMB has a launch-readiness checklist and CMS handoff package.',
    ],
    artifacts_handoff: [
      'FireSpring feedback email and vendor question set',
      'Template comparison and Balance recommendation examples',
      'Content inventory workbook',
      'CMS guide and quality checklist',
      'Launch-readiness decision register',
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
  if (!apply) return dashboardTasks.length

  const { error: deleteError } = await client
    .from('dashboard_tasks')
    .delete()
    .eq('client_project_id', projectId)
    .in('category', [...new Set(dashboardTasks.map((task) => task.category))])

  if (deleteError) throw new Error(`Failed to clear old KMB dashboard tasks: ${deleteError.message}`)

  const { error: insertError } = await client.from('dashboard_tasks').insert(
    dashboardTasks.map((task) => ({
      client_project_id: projectId,
      ...task,
      diy_resources: [],
    }))
  )

  if (insertError) throw new Error(`Failed to insert KMB dashboard tasks: ${insertError.message}`)
  return dashboardTasks.length
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

async function seedTimeEntries(client: ReturnType<typeof supabase>, projectId: string) {
  if (!apply) return 3

  const descriptions = [
    'FireSpring proof review, vendor recommendation research, and feedback synthesis',
    'KMB Balance wireframe examples, visual recommendation package, and presentation support',
    'Neil follow-up email drafting, Gmail send, and Portfolio correspondence reconciliation',
  ]

  const { error: deleteError } = await client
    .from('time_entries')
    .delete()
    .eq('client_project_id', projectId)
    .like('description', 'KMB dashboard seed:%')

  if (deleteError) throw new Error(`Failed to clear KMB time entries: ${deleteError.message}`)

  const { error: insertError } = await client.from('time_entries').insert(
    descriptions.map((description, index) => ({
      client_project_id: projectId,
      target_type: 'milestone',
      target_id: String(index),
      description: `KMB dashboard seed: ${description}`,
      duration_seconds: [7200, 10800, 5400][index],
      started_at: ['2026-05-06T14:00:00.000Z', '2026-06-18T18:00:00.000Z', '2026-07-02T03:00:00.000Z'][index],
      stopped_at: ['2026-05-06T16:00:00.000Z', '2026-06-18T21:00:00.000Z', '2026-07-02T04:30:00.000Z'][index],
      is_running: false,
    }))
  )

  if (insertError) throw new Error(`Failed to seed KMB time entries: ${insertError.message}`)
  return descriptions.length
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
  const scoreSnapshotId = await refreshScoreSnapshot(client, project.id)
  await linkMeetingsAndActions(client, project.id, contactSubmissionId)
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
        scoreSnapshotId,
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
