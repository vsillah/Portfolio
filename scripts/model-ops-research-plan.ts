#!/usr/bin/env tsx
import {
  buildModelOpsResearchPlan,
  formatModelOpsResearchPlanMarkdown,
  type ModelOpsResearchPlan,
} from '../lib/model-ops-research'
import {
  getModelOpsProjection,
  type ModelOpsProjection,
} from '../lib/model-ops-open-brain'

export function parseArgs(argv: string[]) {
  const options = {
    json: false,
    repoSnapshot: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--json') {
      options.json = true
    } else if (arg === '--repo-snapshot') {
      options.repoSnapshot = true
    } else if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  npm run model-ops:research:plan -- [options]

Options:
  --repo-snapshot  Force the planner to use the checked-in Model Ops snapshot.
  --json           Print machine-readable output.
`)
      process.exit(0)
    }
  }

  return options
}

export function buildPlanFromProjection(projection: ModelOpsProjection): ModelOpsResearchPlan {
  return buildModelOpsResearchPlan({ projection })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.repoSnapshot) {
    process.env.MODEL_OPS_FORCE_REPO_SNAPSHOT = '1'
  }

  const plan = buildPlanFromProjection(await getModelOpsProjection())
  if (options.json) {
    console.log(JSON.stringify(plan, null, 2))
    return
  }
  console.log(formatModelOpsResearchPlanMarkdown(plan))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
