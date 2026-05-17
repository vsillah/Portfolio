import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { seedAutomationGoals } from '@/lib/agent-automation-goal-seeding'

export const dynamic = 'force-dynamic'

function parseTier(value: unknown): 1 | 2 | undefined {
  if (value === 1 || value === '1') return 1
  if (value === 2 || value === '2') return 2
  return undefined
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined
}

export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  if (body.confirmation !== 'seed_agent_automation_goals') {
    return NextResponse.json({ error: 'confirmation is required' }, { status: 400 })
  }

  try {
    const seeded = await seedAutomationGoals({
      seedIds: stringArray(body.seed_ids),
      tier: parseTier(body.tier) ?? 1,
      triggeredByUserId: auth.user.id,
    })

    return NextResponse.json({
      ok: true,
      seeded_goals: seeded.map(({ seed, parent, children }) => ({
        seed_id: seed.id,
        title: seed.title,
        parent_work_item: parent,
        child_work_items: children,
      })),
    })
  } catch (error) {
    console.error('[automation-goals] seed failed:', error)
    const message = error instanceof Error ? error.message : 'Failed to seed automation goals'
    const status = message.startsWith('Unknown automation goal seed') ? 400 : 500
    return NextResponse.json(
      { error: message },
      { status },
    )
  }
}
