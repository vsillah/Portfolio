import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import type { AgentRuntime } from '@/lib/agent-run'

export type RuntimeEvaluationTarget = Extract<AgentRuntime, 'opencode'>

export type RuntimeCommandProbe = {
  command: string
  found: boolean
  path: string | null
}

export type RuntimeEvaluationResult = {
  runtime: RuntimeEvaluationTarget
  available: boolean
  executable: string | null
  probes: RuntimeCommandProbe[]
  safeForProductionAutomation: false
  nextSteps: string[]
}

const RUNTIME_COMMANDS: Record<RuntimeEvaluationTarget, string[]> = {
  opencode: ['opencode', 'openclaw', 'opencode-ai'],
}

async function isExecutable(filePath: string) {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    return false
  }
}

export async function probeCommand(command: string, pathValue = process.env.PATH ?? ''): Promise<RuntimeCommandProbe> {
  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(dir, command)
    if (await isExecutable(candidate)) {
      return { command, found: true, path: candidate }
    }
  }

  return { command, found: false, path: null }
}

export async function evaluateRuntimeAvailability(runtime: RuntimeEvaluationTarget): Promise<RuntimeEvaluationResult> {
  const probes = await Promise.all(RUNTIME_COMMANDS[runtime].map((command) => probeCommand(command)))
  const executable = probes.find((probe) => probe.found)?.path ?? null

  return {
    runtime,
    available: executable != null,
    executable,
    probes,
    safeForProductionAutomation: false,
    nextSteps: executable
      ? [
          'Run an isolated read-only test task in a disposable worktree.',
          'Confirm auth configuration without exposing secrets.',
          'Keep production writes behind agent_approvals.',
        ]
      : [
          'Install and authenticate OpenCode/OpenClaw before assigning production work.',
          'Run one observable test task through Agent Operations.',
          'Prove rollback and audit behavior before enabling automation.',
        ],
  }
}
