import { existsSync } from 'fs'
import { homedir } from 'os'
import path from 'path'

export type OpenBrainRuntimeKey = 'codex' | 'hermes' | 'opencode' | 'claude' | 'cursor'
export type OpenBrainRuntimeRegistrationStatus = 'already_registered' | 'ready_to_register' | 'config_missing'

export interface OpenBrainRuntimeRegistrationTarget {
  runtime: OpenBrainRuntimeKey
  label: string
  status: OpenBrainRuntimeRegistrationStatus
  configPath: string
  registrationFormat: 'toml' | 'yaml' | 'json'
  snippet: string
  verifyCommand: string
  note: string
}

export interface OpenBrainRuntimeRegistrationPlan {
  generatedAt: string
  openBrainHome: string
  portfolioRoot: string
  mcpCommand: {
    command: string
    args: string[]
    env: Record<string, string>
  }
  safetyBoundary: string[]
  setupCommands: string[]
  evaluationGates: string[]
  targets: OpenBrainRuntimeRegistrationTarget[]
  nextAction: string
}

export interface OpenBrainRuntimeRegistrationOptions {
  generatedAt?: string
  homeDir?: string
  openBrainHome?: string
  portfolioRoot?: string
  currentWorkingDirectory?: string
  configTextByRuntime?: Partial<Record<OpenBrainRuntimeKey, string | null>>
}

const DEFAULT_TARGETS: Array<{
  runtime: OpenBrainRuntimeKey
  label: string
  configPath: (homeDir: string) => string
  registrationFormat: OpenBrainRuntimeRegistrationTarget['registrationFormat']
}> = [
  {
    runtime: 'codex',
    label: 'Codex',
    configPath: (homeDir) => path.join(homeDir, '.codex', 'config.toml'),
    registrationFormat: 'toml',
  },
  {
    runtime: 'hermes',
    label: 'Hermes',
    configPath: (homeDir) => path.join(homeDir, '.hermes', 'config.yaml'),
    registrationFormat: 'yaml',
  },
  {
    runtime: 'opencode',
    label: 'OpenCode / OpenClaw-style agents',
    configPath: (homeDir) => path.join(homeDir, '.config', 'opencode', 'mcp.json'),
    registrationFormat: 'json',
  },
  {
    runtime: 'claude',
    label: 'Claude Desktop',
    configPath: (homeDir) => path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    registrationFormat: 'json',
  },
  {
    runtime: 'cursor',
    label: 'Cursor',
    configPath: (homeDir) => path.join(homeDir, '.cursor', 'mcp.json'),
    registrationFormat: 'json',
  },
]

export function buildOpenBrainRuntimeRegistrationPlan(
  options: OpenBrainRuntimeRegistrationOptions = {},
): OpenBrainRuntimeRegistrationPlan {
  const homeDir = options.homeDir || homedir()
  const openBrainHome = options.openBrainHome || process.env.OPEN_BRAIN_HOME || path.join(homeDir, '.open-brain')
  const portfolioRoot = options.portfolioRoot ||
    process.env.OPEN_BRAIN_PORTFOLIO_ROOT ||
    resolveDefaultPortfolioRoot(options.currentWorkingDirectory || process.cwd())
  const mcpCommand = {
    command: 'npm',
    args: ['--prefix', portfolioRoot, 'run', 'open-brain:mcp'],
    env: {
      OPEN_BRAIN_HOME: openBrainHome,
      OPEN_BRAIN_PORTFOLIO_ROOT: portfolioRoot,
    },
  }

  const targets = DEFAULT_TARGETS.map((target) => {
    const configPath = target.configPath(homeDir)
    const configText = options.configTextByRuntime?.[target.runtime]
    const hasConfig = configText !== undefined ? configText !== null : existsSync(configPath)
    const alreadyRegistered = Boolean(configText && hasOpenBrainRegistration(configText, openBrainHome, portfolioRoot))
    const status: OpenBrainRuntimeRegistrationStatus = alreadyRegistered
      ? 'already_registered'
      : hasConfig
        ? 'ready_to_register'
        : 'config_missing'

    return {
      runtime: target.runtime,
      label: target.label,
      status,
      configPath,
      registrationFormat: target.registrationFormat,
      snippet: registrationSnippet(target.registrationFormat, mcpCommand),
      verifyCommand: verificationCommand(target.runtime, configPath),
      note: statusNote(status, target.label),
    }
  })

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    openBrainHome,
    portfolioRoot,
    mcpCommand,
    safetyBoundary: [
      'Dry-run packet only; no agent config files are edited by this planner.',
      'Create OPEN_BRAIN_HOME before registration, but do not promote durable memories without approval.',
      'Register each runtime in its own native config surface; Codex config is not inherited by Hermes, Claude, Cursor, OpenCode, or OpenClaw.',
      'OpenClaw is an evaluation candidate until installed and approved; do not add it only for parity if Hermes already covers the required workflow.',
      'After registration, verify each runtime with its own list, doctor, or manual MCP tool call before marking it connected.',
    ],
    setupCommands: [
      `mkdir -p ${shellQuote(openBrainHome)}`,
      `OPEN_BRAIN_HOME=${shellQuote(openBrainHome)} OPEN_BRAIN_PORTFOLIO_ROOT=${shellQuote(portfolioRoot)} npm --prefix ${shellQuote(portfolioRoot)} test -- --run scripts/open-brain-mcp-server.test.ts lib/open-brain.test.ts`,
      `OPEN_BRAIN_HOME=${shellQuote(openBrainHome)} OPEN_BRAIN_PORTFOLIO_ROOT=${shellQuote(portfolioRoot)} npm --prefix ${shellQuote(portfolioRoot)} run open-brain:runtime-registration`,
    ],
    evaluationGates: [
      'Open Brain MCP support: the runtime can register the local Open Brain stdio server without copying secrets or weakening approval gates.',
      'Personality pack ingestion: the runtime can consume generated public-safe/personality-pack exports without drifting from the canonical corpus.',
      'Governance fit: durable memory writes remain proposal-gated, auditable, reversible, and local-first.',
      'Differentiated value: the runtime provides coding, planning, long-running execution, or interoperability capabilities that Hermes does not already cover.',
      'Operational cost: setup, auth, config backups, doctor/list verification, and rollback are simple enough to maintain across future parity checks.',
    ],
    targets,
    nextAction: 'Review the target snippets, approve one runtime registration at a time, then run the matching verify command.',
  }
}

export function renderOpenBrainRuntimeRegistrationMarkdown(plan: OpenBrainRuntimeRegistrationPlan): string {
  return [
    '# Open Brain Runtime Registration Packet',
    '',
    `Generated: ${plan.generatedAt}`,
    '',
    '## Runtime',
    '',
    `- Open Brain home: \`${plan.openBrainHome}\``,
    `- Portfolio root: \`${plan.portfolioRoot}\``,
    `- MCP command: \`${plan.mcpCommand.command} ${plan.mcpCommand.args.map(shellQuote).join(' ')}\``,
    '',
    '## Safety Boundary',
    '',
    ...plan.safetyBoundary.map((item) => `- ${item}`),
    '',
    '## Setup Checks',
    '',
    ...plan.setupCommands.map((command) => `- \`${command}\``),
    '',
    '## Evaluation Gates',
    '',
    ...plan.evaluationGates.map((item) => `- ${item}`),
    '',
    '## Targets',
    '',
    ...plan.targets.flatMap((target) => [
      `### ${target.label}`,
      '',
      `- Status: \`${target.status}\``,
      `- Config path: \`${target.configPath}\``,
      `- Format: \`${target.registrationFormat}\``,
      `- Verify: \`${target.verifyCommand}\``,
      `- Note: ${target.note}`,
      '',
      '```' + target.registrationFormat,
      target.snippet,
      '```',
      '',
    ]),
    '## Next Action',
    '',
    plan.nextAction,
    '',
  ].join('\n')
}

function registrationSnippet(
  format: OpenBrainRuntimeRegistrationTarget['registrationFormat'],
  command: OpenBrainRuntimeRegistrationPlan['mcpCommand'],
) {
  if (format === 'toml') {
    return [
      '[mcp_servers.open-brain]',
      `command = "${command.command}"`,
      `args = ${JSON.stringify(command.args)}`,
      `[mcp_servers.open-brain.env]`,
      `OPEN_BRAIN_HOME = "${command.env.OPEN_BRAIN_HOME}"`,
      `OPEN_BRAIN_PORTFOLIO_ROOT = "${command.env.OPEN_BRAIN_PORTFOLIO_ROOT}"`,
    ].join('\n')
  }

  if (format === 'yaml') {
    return [
      'mcpServers:',
      '  open-brain:',
      `    command: ${command.command}`,
      `    args: ${JSON.stringify(command.args)}`,
      '    env:',
      `      OPEN_BRAIN_HOME: ${command.env.OPEN_BRAIN_HOME}`,
      `      OPEN_BRAIN_PORTFOLIO_ROOT: ${command.env.OPEN_BRAIN_PORTFOLIO_ROOT}`,
    ].join('\n')
  }

  return JSON.stringify({
    mcpServers: {
      'open-brain': {
        command: command.command,
        args: command.args,
        env: command.env,
      },
    },
  }, null, 2)
}

function verificationCommand(runtime: OpenBrainRuntimeKey, configPath: string) {
  if (runtime === 'codex') return `rg -n "open-brain|OPEN_BRAIN_HOME" ${shellQuote(configPath)}`
  if (runtime === 'hermes') return `rg -n "open-brain|OPEN_BRAIN_HOME" ${shellQuote(configPath)}`
  return `test -f ${shellQuote(configPath)} && rg -n "open-brain|OPEN_BRAIN_HOME" ${shellQuote(configPath)}`
}

function statusNote(status: OpenBrainRuntimeRegistrationStatus, label: string) {
  if (status === 'already_registered') return `${label} already appears to reference the local Open Brain MCP server.`
  if (status === 'ready_to_register') return `${label} config exists; append or merge the snippet after approval.`
  return `${label} config was not found at the expected path; create it only if this runtime is installed and should connect.`
}

function hasOpenBrainRegistration(configText: string, openBrainHome: string, portfolioRoot: string) {
  return configText.includes('open-brain') &&
    configText.includes('OPEN_BRAIN_HOME') &&
    configText.includes(openBrainHome) &&
    configText.includes(portfolioRoot)
}

export function resolveDefaultPortfolioRoot(cwd: string) {
  const marker = `${path.sep}Portfolio.worktrees${path.sep}`
  if (!cwd.includes(marker)) return cwd
  const projectsRoot = cwd.slice(0, cwd.indexOf(marker))
  const canonicalPortfolioRoot = path.join(projectsRoot, 'Portfolio')
  return existsSync(canonicalPortfolioRoot) ? canonicalPortfolioRoot : cwd
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
