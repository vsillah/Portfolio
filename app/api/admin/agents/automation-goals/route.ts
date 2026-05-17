import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { listAutomationGoalSeeds } from '@/lib/agent-automation-goals'
import { listAutomationGoalSeedStates } from '@/lib/agent-automation-goal-seeding'

export const dynamic = 'force-dynamic'

function parseTier(value: string | null): 1 | 2 | undefined {
  if (value === '1') return 1
  if (value === '2') return 2
  return undefined
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const tier = parseTier(new URL(request.url).searchParams.get('tier'))
  const seeds = listAutomationGoalSeeds(tier)
  const states = await listAutomationGoalSeedStates()
  const statesBySeed = new Map(states.map((state) => [state.seedId, state]))

  return NextResponse.json({
    goals: seeds.map((seed) => {
      const state = statesBySeed.get(seed.id)
      return {
        ...seed,
        seeded: Boolean(state?.parent),
        seeded_parent_work_item: state?.parent ?? null,
        seeded_child_count: state?.children.length ?? 0,
      }
    }),
  })
}
