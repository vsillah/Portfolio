#!/usr/bin/env tsx
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import {
  buildOpenBrainRuntimeRegistrationPlan,
  renderOpenBrainRuntimeRegistrationMarkdown,
  type OpenBrainRuntimeKey,
} from '../lib/open-brain-runtime-registration'

async function main() {
  const args = process.argv.slice(2)
  const format = args.includes('--json') ? 'json' : 'markdown'
  const writeIndex = args.indexOf('--write')
  const outPath = writeIndex >= 0 ? args[writeIndex + 1] : null
  const homeDir = process.env.HOME || undefined
  const configTextByRuntime = await loadConfigText(homeDir)
  const plan = buildOpenBrainRuntimeRegistrationPlan({ configTextByRuntime })
  const output = format === 'json'
    ? `${JSON.stringify(plan, null, 2)}\n`
    : renderOpenBrainRuntimeRegistrationMarkdown(plan)

  if (outPath) {
    const resolved = path.resolve(outPath)
    await mkdir(path.dirname(resolved), { recursive: true })
    await writeFile(resolved, output, 'utf8')
    console.log(`Wrote Open Brain runtime registration packet to ${resolved}`)
    return
  }

  process.stdout.write(output)
}

async function loadConfigText(homeDir?: string): Promise<Partial<Record<OpenBrainRuntimeKey, string | null>>> {
  if (!homeDir) return {}
  const paths: Record<OpenBrainRuntimeKey, string> = {
    codex: path.join(homeDir, '.codex', 'config.toml'),
    hermes: path.join(homeDir, '.hermes', 'config.yaml'),
    opencode: path.join(homeDir, '.config', 'opencode', 'mcp.json'),
    claude: path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    cursor: path.join(homeDir, '.cursor', 'mcp.json'),
  }
  const entries = await Promise.all(
    Object.entries(paths).map(async ([runtime, configPath]) => {
      const text = await readFile(configPath, 'utf8').catch(() => null)
      return [runtime, text] as const
    }),
  )
  return Object.fromEntries(entries) as Partial<Record<OpenBrainRuntimeKey, string | null>>
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[open-brain-runtime-registration] failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
