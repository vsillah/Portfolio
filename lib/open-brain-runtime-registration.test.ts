import { describe, expect, it } from 'vitest'
import {
  buildOpenBrainRuntimeRegistrationPlan,
  renderOpenBrainRuntimeRegistrationMarkdown,
  resolveDefaultPortfolioRoot,
} from './open-brain-runtime-registration'

describe('Open Brain runtime registration planner', () => {
  it('builds approval-gated registration snippets for each runtime', () => {
    const plan = buildOpenBrainRuntimeRegistrationPlan({
      generatedAt: '2026-05-27T12:00:00.000Z',
      homeDir: '/Users/example',
      openBrainHome: '/Users/example/.open-brain',
      portfolioRoot: '/Users/example/Projects/Portfolio',
      configTextByRuntime: {
        codex: '[mcp_servers.open-brain]\nOPEN_BRAIN_HOME = "/Users/example/.open-brain"\nOPEN_BRAIN_PORTFOLIO_ROOT = "/Users/example/Projects/Portfolio"',
        hermes: '',
        opencode: null,
        claude: null,
        cursor: null,
      },
    })

    expect(plan.openBrainHome).toBe('/Users/example/.open-brain')
    expect(plan.mcpCommand).toEqual({
      command: 'npm',
      args: ['--prefix', '/Users/example/Projects/Portfolio', 'run', 'open-brain:mcp'],
      env: {
        OPEN_BRAIN_HOME: '/Users/example/.open-brain',
        OPEN_BRAIN_PORTFOLIO_ROOT: '/Users/example/Projects/Portfolio',
      },
    })
    expect(plan.safetyBoundary.join(' ')).toContain('no agent config files are edited')
    expect(plan.targets.map((target) => target.runtime)).toEqual([
      'codex',
      'hermes',
      'opencode',
      'claude',
      'cursor',
    ])
    expect(plan.targets.find((target) => target.runtime === 'codex')?.status).toBe('already_registered')
    expect(plan.targets.find((target) => target.runtime === 'hermes')?.status).toBe('ready_to_register')
    expect(plan.targets.find((target) => target.runtime === 'claude')?.status).toBe('config_missing')
  })

  it('renders a reviewable markdown packet without secret values', () => {
    const plan = buildOpenBrainRuntimeRegistrationPlan({
      generatedAt: '2026-05-27T12:00:00.000Z',
      homeDir: '/Users/example',
      openBrainHome: '/Users/example/.open-brain',
      portfolioRoot: '/Users/example/Projects/Portfolio',
      configTextByRuntime: {},
    })

    const markdown = renderOpenBrainRuntimeRegistrationMarkdown(plan)

    expect(markdown).toContain('# Open Brain Runtime Registration Packet')
    expect(markdown).toContain('## Safety Boundary')
    expect(markdown).toContain('### Codex')
    expect(markdown).toContain('OPEN_BRAIN_HOME')
    expect(markdown).not.toMatch(/sk-[A-Za-z0-9]/)
    expect(markdown).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('resolves known Portfolio worktree paths back to the canonical checkout when present', () => {
    const resolved = resolveDefaultPortfolioRoot('/Users/vambahsillah/Projects/Portfolio.worktrees/open-brain-runtime-registration')

    expect(resolved).toBe('/Users/vambahsillah/Projects/Portfolio')
  })
})
