#!/usr/bin/env tsx
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'synthetic-client-ai-ops-qa-runner'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'synthetic-client-ai-ops-qa-runner'

async function main() {
  const {
    buildClientAiOpsSmokeEvidencePacket,
    buildClientAiOpsRealPilotQaPlan,
    formatClientAiOpsSmokeEvidencePacket,
    formatClientAiOpsRealPilotQaPlan,
  } = await import('../lib/client-ai-ops-real-pilot-qa')

  const args = new Set(process.argv.slice(2))
  const plan = buildClientAiOpsRealPilotQaPlan()

  if (args.has('--evidence-template')) {
    const packet = buildClientAiOpsSmokeEvidencePacket(plan)
    console.log(formatClientAiOpsSmokeEvidencePacket(packet))
  } else if (args.has('--json')) {
    console.log(JSON.stringify(plan, null, 2))
  } else {
    console.log(formatClientAiOpsRealPilotQaPlan(plan, {
      includeDetails: !args.has('--summary'),
    }))
  }

  if (plan.summary.blocked > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
