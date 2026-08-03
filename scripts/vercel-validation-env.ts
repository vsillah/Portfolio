import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

type ProjectLink = {
  orgId?: string
  projectId?: string
}

type VercelEnv = {
  key?: string
  id?: string
  target?: string | string[]
}

type VercelProject = {
  protectionBypass?: Record<string, { isEnvVar?: boolean }>
}

function readProjectLink(cwd = process.cwd()): Required<ProjectLink> | null {
  const file = path.join(cwd, '.vercel', 'project.json')
  if (!fs.existsSync(file)) return null

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectLink
  if (!parsed.orgId || !parsed.projectId) return null
  return { orgId: parsed.orgId, projectId: parsed.projectId }
}

function vercelApi<T>(endpoint: string, cwd = process.cwd()): T {
  const output = execFileSync('vercel', ['api', endpoint, '--raw'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  return JSON.parse(output) as T
}

function targetIncludes(env: VercelEnv, target: string): boolean {
  if (Array.isArray(env.target)) return env.target.includes(target)
  return env.target === target
}

export function getVercelAutomationBypassSecret(cwd = process.cwd()): string | undefined {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }

  try {
    const link = readProjectLink(cwd)
    if (!link) return undefined

    const project = vercelApi<VercelProject>(
      `/v9/projects/${link.projectId}?teamId=${link.orgId}`,
      cwd,
    )

    return Object.entries(project.protectionBypass || {}).find(
      ([, value]) => value?.isEnvVar,
    )?.[0]
  } catch {
    return undefined
  }
}

export function getVercelProjectEnvValues(
  keys: string[],
  target = 'preview',
  cwd = process.cwd(),
): Record<string, string> {
  const link = readProjectLink(cwd)
  if (!link) return {}

  try {
    const envList = vercelApi<{ envs?: VercelEnv[] }>(
      `/v10/projects/${link.projectId}/env?teamId=${link.orgId}`,
      cwd,
    )

    const values: Record<string, string> = {}
    for (const key of keys) {
      const env = (envList.envs || []).find(
        (candidate) => candidate.key === key && targetIncludes(candidate, target),
      )
      if (!env?.id) continue

      const detail = vercelApi<{ value?: string }>(
        `/v1/projects/${link.projectId}/env/${env.id}?teamId=${link.orgId}`,
        cwd,
      )
      if (detail.value) values[key] = detail.value
    }

    return values
  } catch {
    return {}
  }
}

export function getVercelEnvTargetForBaseUrl(baseUrl: string): 'preview' | 'production' | undefined {
  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    return undefined
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined
  }

  if (hostname.endsWith('.vercel.app')) {
    return 'preview'
  }

  return 'production'
}
