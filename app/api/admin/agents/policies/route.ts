import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { DEFAULT_AGENT_BUDGET_RULES } from '@/lib/agent-budget-policy'
import { APPROVAL_GATES, RUNTIME_POLICIES } from '@/lib/agent-policy'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return NextResponse.json({
    policies: RUNTIME_POLICIES,
    approval_gates: APPROVAL_GATES,
    budget_rules: DEFAULT_AGENT_BUDGET_RULES,
  })
}
