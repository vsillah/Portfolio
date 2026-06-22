import type { MobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry'

export type MobileFoundryPrototypePacket = {
  id: string
  generated_at: string
  mode: 'read_only'
  backlog_record_id: string
  app_title: string
  audience: string
  job_to_be_done: string
  popularity_score: number
  owner_agent_role: 'Imhotep (Kemet) - Prototype Architect'
  coordinator_agent_role: 'Shaka (Zulu) - Chief of Staff'
  recommended_stack: string[]
  repo_plan: {
    proposed_repo_slug: string
    repo_creation_status: 'approval_required'
    default_branch: string
    suggested_branch: string
    project_type: 'mobile_app_prototype'
  }
  mvp_scope: string[]
  build_milestones: string[]
  smoke_tests: string[]
  demo_evidence: string[]
  commercialization_assumptions: string[]
  risks: string[]
  approval_gates: string[]
  side_effects: {
    creates_repository: false
    creates_github_account: false
    installs_paid_api: false
    invites_testers: false
    submits_to_store: false
    changes_pricing: false
    publishes_claims: false
    collects_user_data: false
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'mobile-app-prototype'
}

function withFallback(values: string[], fallback: string[]) {
  return values.length ? values : fallback
}

export function buildMobileFoundryPrototypePacket(
  record: MobileFoundryBacklogRecord,
  generatedAt = new Date().toISOString(),
): MobileFoundryPrototypePacket {
  const repoSlug = `mobile-${slugify(record.title)}`
  const mvpScope = withFallback(record.prototype_scope, [
    'Define the primary mobile user flow.',
    'Build a clickable prototype for the core job.',
    'Capture validation notes and demo evidence.',
  ])

  return {
    id: `prototype-packet:${record.id}:v1`,
    generated_at: generatedAt,
    mode: 'read_only',
    backlog_record_id: record.id,
    app_title: record.title,
    audience: record.audience,
    job_to_be_done: record.job_to_be_done,
    popularity_score: record.popularity_score,
    owner_agent_role: 'Imhotep (Kemet) - Prototype Architect',
    coordinator_agent_role: 'Shaka (Zulu) - Chief of Staff',
    recommended_stack: ['Expo', 'React Native', 'TypeScript', 'Supabase or local mock data first'],
    repo_plan: {
      proposed_repo_slug: repoSlug,
      repo_creation_status: 'approval_required',
      default_branch: 'main',
      suggested_branch: `codex/${repoSlug}-prototype`,
      project_type: 'mobile_app_prototype',
    },
    mvp_scope: mvpScope,
    build_milestones: [
      'Draft product brief, target user, core flow, and non-goals.',
      'Create low-risk prototype shell with seeded local data.',
      'Implement the primary interaction loop and empty/error states.',
      'Run focused type, lint, unit, and simulator or browser smoke checks.',
      'Capture demo screenshots or video and summarize validation evidence.',
    ],
    smoke_tests: [
      'Install dependencies without using paid APIs or hidden credentials.',
      'Run typecheck and lint for the generated prototype.',
      'Launch the app in a simulator or browser preview.',
      'Complete the core user flow from first screen to output/result.',
      'Confirm no private source notes, tester data, secrets, or unapproved claims appear in the UI.',
    ],
    demo_evidence: [
      'Prototype route or local app launch command.',
      'Desktop or simulator screenshot of the first screen.',
      'Screenshot or short clip of the core interaction loop.',
      'Validation notes mapped to the original backlog score factors.',
      'Known gaps, risks, and approval requests for the next phase.',
    ],
    commercialization_assumptions: withFallback(record.commercialization_path, [
      'Commercialization path remains pending until prototype validation.',
      'Pricing, tester outreach, and store submission require separate approval.',
    ]),
    risks: withFallback(record.risks, ['No material risks were supplied; require human review before build delegation.']),
    approval_gates: [
      'Create repository or new GitHub owner.',
      'Use paid APIs, app store accounts, or third-party services.',
      'Invite testers or collect user data.',
      'Submit to App Store Connect or Google Play.',
      'Set pricing, subscription terms, or payment setup.',
      'Publish public/client-facing claims or add the prototype to the service offer.',
    ],
    side_effects: {
      creates_repository: false,
      creates_github_account: false,
      installs_paid_api: false,
      invites_testers: false,
      submits_to_store: false,
      changes_pricing: false,
      publishes_claims: false,
      collects_user_data: false,
    },
  }
}

function section(title: string, lines: string[]) {
  return [`## ${title}`, '', ...lines.map((line) => `- ${line}`), ''].join('\n')
}

export function renderMobileFoundryPrototypePacketMarkdown(packet: MobileFoundryPrototypePacket) {
  return [
    `# ${packet.app_title} Prototype Packet`,
    '',
    `Generated: ${packet.generated_at}`,
    `Mode: ${packet.mode}`,
    `Backlog record: ${packet.backlog_record_id}`,
    `Popularity score: ${packet.popularity_score}/100`,
    '',
    '## Brief',
    '',
    `Audience: ${packet.audience}`,
    `Job to be done: ${packet.job_to_be_done}`,
    `Owner role: ${packet.owner_agent_role}`,
    `Coordinator: ${packet.coordinator_agent_role}`,
    '',
    '## Repo Plan',
    '',
    `- Proposed repo slug: ${packet.repo_plan.proposed_repo_slug}`,
    `- Repo creation status: ${packet.repo_plan.repo_creation_status}`,
    `- Suggested branch: ${packet.repo_plan.suggested_branch}`,
    '',
    section('Recommended Stack', packet.recommended_stack),
    section('MVP Scope', packet.mvp_scope),
    section('Build Milestones', packet.build_milestones),
    section('Smoke Tests', packet.smoke_tests),
    section('Demo Evidence', packet.demo_evidence),
    section('Commercialization Assumptions', packet.commercialization_assumptions),
    section('Risks', packet.risks),
    section('Approval Gates', packet.approval_gates),
    '## Side Effects',
    '',
    '- No repository, GitHub account, paid API, tester invite, store submission, pricing change, public claim, or user-data collection is created by this packet.',
    '',
  ].join('\n')
}
