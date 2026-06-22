import type { MobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry'

export type MobileFoundryPrototypeValidationStatus = 'pending_review' | 'needs_revision' | 'validated'

export type MobileFoundryCommercializationInput = {
  validation_status?: MobileFoundryPrototypeValidationStatus
  prototype_url?: string | null
  demo_evidence?: string[]
  tester_profile?: string[]
  privacy_notes?: string[]
  pricing_notes?: string[]
  store_notes?: string[]
  launch_notes?: string[]
}

export type MobileFoundryCommercializationPacket = {
  id: string
  generated_at: string
  mode: 'read_only'
  backlog_record_id: string
  app_title: string
  audience: string
  job_to_be_done: string
  validation_status: MobileFoundryPrototypeValidationStatus
  prototype_url: string | null
  owner_agent_role: 'Kandake (Kush) - Commercialization Captain'
  coordinator_agent_role: 'Shaka (Zulu) - Chief of Staff'
  tester_packet: string[]
  pricing_notes: string[]
  privacy_checklist: string[]
  store_readiness_checks: string[]
  public_launch_criteria: string[]
  commercialization_path: string[]
  demo_evidence: string[]
  risks: string[]
  approval_gates: string[]
  side_effects: {
    invites_testers: false
    creates_tester_list: false
    collects_user_data: false
    submits_to_store: false
    changes_pricing: false
    creates_payment_product: false
    publishes_public_claims: false
    sends_outbound_messages: false
  }
}

function withFallback(values: string[] | undefined, fallback: string[]) {
  return values && values.length ? values : fallback
}

function cleanUrl(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function buildMobileFoundryCommercializationPacket(
  record: MobileFoundryBacklogRecord,
  input: MobileFoundryCommercializationInput = {},
  generatedAt = new Date().toISOString(),
): MobileFoundryCommercializationPacket {
  const validationStatus = input.validation_status ?? 'pending_review'

  return {
    id: `commercialization-packet:${record.id}:v1`,
    generated_at: generatedAt,
    mode: 'read_only',
    backlog_record_id: record.id,
    app_title: record.title,
    audience: record.audience,
    job_to_be_done: record.job_to_be_done,
    validation_status: validationStatus,
    prototype_url: cleanUrl(input.prototype_url),
    owner_agent_role: 'Kandake (Kush) - Commercialization Captain',
    coordinator_agent_role: 'Shaka (Zulu) - Chief of Staff',
    tester_packet: withFallback(input.tester_profile, [
      `Recruit a small reviewer group that matches: ${record.audience}.`,
      'Prepare a tester brief with goal, prototype link, test tasks, expected time, and feedback questions.',
      'Confirm consent language and data-handling boundaries before any tester invite.',
      'Keep tester outreach pending until Vambah approves the message, list, and channel.',
    ]),
    pricing_notes: withFallback(input.pricing_notes, [
      'Treat pricing as a hypothesis until prototype value is validated.',
      'Compare free demo, fixed-price build service, subscription companion, and bundled Mobile App Generation delivery.',
      'Do not create payment products, checkout links, subscription plans, or public price claims from this packet.',
    ]),
    privacy_checklist: withFallback(input.privacy_notes, [
      'Identify whether the prototype collects personal data, voice, photos, location, contacts, health, financial, legal, or child-related data.',
      'Prefer local mock data or explicit test fixtures until data collection is approved.',
      'Draft privacy copy before tester collection or store submission.',
      'Confirm secrets, private source notes, and raw GitHub inventory are absent from the prototype UI and logs.',
    ]),
    store_readiness_checks: withFallback(input.store_notes, [
      'Confirm app name, bundle identifier, screenshots, support URL, privacy URL, and age rating requirements.',
      'Check Apple App Store and Google Play policy risks for the app category before submission.',
      'List required third-party SDK disclosures and data safety declarations.',
      'Keep App Store Connect and Google Play submission pending until Vambah approves the final packet.',
    ]),
    public_launch_criteria: withFallback(input.launch_notes, [
      'Prototype has passed focused smoke tests and has current demo evidence.',
      'Public copy makes only validated claims and keeps validation sources private.',
      'Pricing, tester feedback, privacy posture, and rollback notes have been reviewed.',
      'Vambah approves adding the app as a public proof point or client-facing offer.',
    ]),
    commercialization_path: withFallback(record.commercialization_path, [
      'Commercialization path remains pending until prototype validation and human review.',
    ]),
    demo_evidence: withFallback(input.demo_evidence, [
      'Prototype demo evidence is pending. Attach screenshots, video, route, build artifact, or simulator proof before launch review.',
    ]),
    risks: withFallback(record.risks, [
      'No app-specific risks were supplied. Require review before tester outreach, data collection, pricing, or store submission.',
    ]),
    approval_gates: [
      'Invite testers or create a tester list.',
      'Collect user data or connect live analytics.',
      'Submit to App Store Connect or Google Play.',
      'Set pricing, subscriptions, payment products, checkout links, or discounts.',
      'Publish public claims, case studies, testimonials, screenshots, or service guarantees.',
      'Turn the prototype into a public/client-facing Mobile App Generation offer.',
    ],
    side_effects: {
      invites_testers: false,
      creates_tester_list: false,
      collects_user_data: false,
      submits_to_store: false,
      changes_pricing: false,
      creates_payment_product: false,
      publishes_public_claims: false,
      sends_outbound_messages: false,
    },
  }
}

function section(title: string, lines: string[]) {
  return [`## ${title}`, '', ...lines.map((line) => `- ${line}`), ''].join('\n')
}

export function renderMobileFoundryCommercializationPacketMarkdown(
  packet: MobileFoundryCommercializationPacket,
) {
  return [
    `# ${packet.app_title} Commercialization Packet`,
    '',
    `Generated: ${packet.generated_at}`,
    `Mode: ${packet.mode}`,
    `Backlog record: ${packet.backlog_record_id}`,
    `Validation status: ${packet.validation_status}`,
    packet.prototype_url ? `Prototype URL: ${packet.prototype_url}` : 'Prototype URL: pending',
    '',
    '## Brief',
    '',
    `Audience: ${packet.audience}`,
    `Job to be done: ${packet.job_to_be_done}`,
    `Owner role: ${packet.owner_agent_role}`,
    `Coordinator: ${packet.coordinator_agent_role}`,
    '',
    section('Tester Packet', packet.tester_packet),
    section('Pricing Notes', packet.pricing_notes),
    section('Privacy Checklist', packet.privacy_checklist),
    section('Store Readiness Checks', packet.store_readiness_checks),
    section('Public Launch Criteria', packet.public_launch_criteria),
    section('Commercialization Path', packet.commercialization_path),
    section('Demo Evidence', packet.demo_evidence),
    section('Risks', packet.risks),
    section('Approval Gates', packet.approval_gates),
    '## Side Effects',
    '',
    '- No tester invite, tester list, user-data collection, store submission, pricing change, payment product, public claim, or outbound message is created by this packet.',
    '',
  ].join('\n')
}
