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

type VercelDeployment = {
  projectId?: string
  target?: string
}

type ResolvedVercelProject = Required<ProjectLink> & {
  target?: 'preview' | 'production'
}

function readProjectLink(cwd = process.cwd()): Required<ProjectLink> | null {
  const candidates = projectLinkCandidates(cwd)

  for (const candidate of candidates) {
    const file = path.join(candidate, '.vercel', 'project.json')
    if (!fs.existsSync(file)) continue

    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ProjectLink
    if (parsed.orgId && parsed.projectId) {
      return { orgId: parsed.orgId, projectId: parsed.projectId }
    }
  }

  return null
}

function projectLinkCandidates(cwd: string): string[] {
  const candidates: string[] = []
  const resolved = path.resolve(cwd)
  let current = resolved

  while (true) {
    candidates.push(current)
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }

  const parts = resolved.split(path.sep)
  const worktreesIndex = parts.findIndex((part) => part.endsWith('.worktrees'))
  if (worktreesIndex > 0) {
    const canonicalName = parts[worktreesIndex].replace(/\.worktrees$/, '')
    const canonicalRoot = path.join(path.sep, ...parts.slice(1, worktreesIndex), canonicalName)
    candidates.push(canonicalRoot)
  }

  return [...new Set(candidates)]
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
  return getVercelAutomationBypassSecretForProject(cwd, readProjectLink(cwd) ?? undefined)
}

function getVercelAutomationBypassSecretForProject(
  cwd: string,
  link?: Required<ProjectLink>,
): string | undefined {
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    return process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  }

  try {
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

export function getVercelAutomationBypassSecretForBaseUrl(
  baseUrl: string,
  cwd = process.cwd(),
): string | undefined {
  const resolved = resolveVercelProjectForBaseUrl(baseUrl, cwd)
  return getVercelAutomationBypassSecretForProject(cwd, resolved ?? undefined)
}

export function getVercelProjectEnvValues(
  keys: string[],
  target = 'preview',
  cwd = process.cwd(),
  projectLink: Required<ProjectLink> | null = readProjectLink(cwd),
): Record<string, string> {
  const link = projectLink
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

export function getVercelProjectEnvValuesForBaseUrl(
  keys: string[],
  baseUrl: string,
  cwd = process.cwd(),
): Record<string, string> {
  const resolved = resolveVercelProjectForBaseUrl(baseUrl, cwd)
  const target = resolved?.target ?? getVercelEnvTargetForBaseUrl(baseUrl)

  if (!resolved || !target) return {}

  return getVercelProjectEnvValues(keys, target, cwd, resolved)
}

export function resolveVercelProjectForBaseUrl(
  baseUrl: string,
  cwd = process.cwd(),
): ResolvedVercelProject | null {
  const link = readProjectLink(cwd)
  const target = getVercelEnvTargetForBaseUrl(baseUrl)
  if (!link || !target) return null

  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    return null
  }

  try {
    const deployment = vercelApi<VercelDeployment>(
      `/v13/deployments/${encodeURIComponent(hostname)}?teamId=${link.orgId}`,
      cwd,
    )

    return {
      orgId: link.orgId,
      projectId: deployment.projectId || link.projectId,
      target: deployment.target === 'production' ? 'production' : 'preview',
    }
  } catch {
    return {
      ...link,
      target,
    }
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
