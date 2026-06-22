import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { parseMobileFoundryBacklogRecord } from '@/lib/mobile-app-foundry-work-items'
import {
  buildMobileFoundryCommercializationPacket,
  renderMobileFoundryCommercializationPacketMarkdown,
  type MobileFoundryCommercializationInput,
  type MobileFoundryPrototypeValidationStatus,
} from '@/lib/mobile-app-foundry-commercialization-packet'

export const dynamic = 'force-dynamic'

const VALIDATION_STATUSES: MobileFoundryPrototypeValidationStatus[] = [
  'pending_review',
  'needs_revision',
  'validated',
]

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : undefined
}

function parseCommercializationInput(value: unknown): MobileFoundryCommercializationInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const body = value as Record<string, unknown>
  const status = typeof body.validation_status === 'string' && VALIDATION_STATUSES.includes(body.validation_status as MobileFoundryPrototypeValidationStatus)
    ? body.validation_status as MobileFoundryPrototypeValidationStatus
    : undefined

  return {
    validation_status: status,
    prototype_url: typeof body.prototype_url === 'string' ? body.prototype_url : null,
    demo_evidence: stringArray(body.demo_evidence),
    tester_profile: stringArray(body.tester_profile),
    privacy_notes: stringArray(body.privacy_notes),
    pricing_notes: stringArray(body.pricing_notes),
    store_notes: stringArray(body.store_notes),
    launch_notes: stringArray(body.launch_notes),
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const record = parseMobileFoundryBacklogRecord(body.backlog_record)
  if (!record) {
    return NextResponse.json(
      { error: 'backlog_record with id, title, audience, job_to_be_done, and vambah_fit_summary is required' },
      { status: 400 },
    )
  }

  if (
    body.commercialization_input &&
    typeof body.commercialization_input === 'object' &&
    !Array.isArray(body.commercialization_input)
  ) {
    const rawStatus = (body.commercialization_input as Record<string, unknown>).validation_status
    if (typeof rawStatus === 'string' && !VALIDATION_STATUSES.includes(rawStatus as MobileFoundryPrototypeValidationStatus)) {
      return NextResponse.json({ error: 'Invalid validation_status' }, { status: 400 })
    }
  }

  const generatedAt = typeof body.generated_at === 'string' ? body.generated_at : undefined
  const packet = buildMobileFoundryCommercializationPacket(
    record,
    parseCommercializationInput(body.commercialization_input),
    generatedAt,
  )

  return NextResponse.json({
    ok: true,
    mode: 'read_only',
    packet,
    markdown: renderMobileFoundryCommercializationPacketMarkdown(packet),
    side_effects: packet.side_effects,
  })
}
