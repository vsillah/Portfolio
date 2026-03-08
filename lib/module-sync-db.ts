/**
 * Module sync config from DB — merged with code-defined module list and custom modules.
 * Spun-off repo URL is stored in module_sync_config (code-defined) or module_sync_custom (custom).
 * Suggested URL is resolved from GitHub API (repos matching module id) or from GITHUB_REPO owner.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  MODULE_SYNC_ENTRIES,
  type ModuleSyncEntry,
} from './module-sync-config'

const GITHUB_API = 'https://api.github.com'

/** UUID v4 regex; custom module ids are UUIDs. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isCustomModuleId(moduleId: string): boolean {
  return UUID_REGEX.test(moduleId.trim())
}

/** Parse GITHUB_REPO env: "owner/repo" or "https://github.com/owner/repo" → { owner, repo }. */
export function parseGitHubRepoEnv(value: string | undefined): { owner: string; repo: string } | null {
  const v = value?.trim()
  if (!v) return null
  const urlMatch = v.match(/github\.com[/:](\w[\w.-]*)\/([\w.-]+?)(?:\.git)?\/?$/i)
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] }
  const slashMatch = v.match(/^([\w.-]+)\/([\w.-]+)$/)
  if (slashMatch) return { owner: slashMatch[1], repo: slashMatch[2] }
  return null
}

/** Fetch owner's repos from GitHub API; return Map of repo name → html_url. Uses GITHUB_TOKEN. */
async function fetchOwnerRepos(owner: string): Promise<Map<string, string>> {
  const token = process.env.GITHUB_TOKEN
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
  const map = new Map<string, string>()

  for (const endpoint of [
    `${GITHUB_API}/users/${owner}/repos?per_page=100`,
    `${GITHUB_API}/orgs/${owner}/repos?per_page=100`,
  ]) {
    const res = await fetch(endpoint, { headers })
    if (!res.ok) continue
    const data = (await res.json()) as Array<{ name: string; html_url?: string }>
    for (const r of data ?? []) {
      if (r.name && r.html_url) map.set(r.name, r.html_url)
    }
    break
  }
  return map
}

/** Fetch all rows from module_sync_config keyed by module_id. */
export async function getModuleSyncConfigFromDb(): Promise<Map<string, { spun_off_repo_url: string | null }>> {
  if (!supabaseAdmin) return new Map()
  const { data, error } = await supabaseAdmin
    .from('module_sync_config')
    .select('module_id, spun_off_repo_url')
  if (error) {
    console.error('[module-sync-db] Failed to fetch config:', error)
    return new Map()
  }
  const map = new Map<string, { spun_off_repo_url: string | null }>()
  for (const row of data ?? []) {
    map.set(row.module_id, { spun_off_repo_url: row.spun_off_repo_url ?? null })
  }
  return map
}

export interface ModuleSyncCustomRow {
  id: string
  name: string
  portfolio_path: string
  spun_off_repo_url: string | null
  created_at?: string
  created_by?: string | null
}

/** Fetch all custom modules from module_sync_custom. */
export async function getCustomModulesFromDb(): Promise<ModuleSyncCustomRow[]> {
  if (!supabaseAdmin) return []
  const { data, error } = await supabaseAdmin
    .from('module_sync_custom')
    .select('id, name, portfolio_path, spun_off_repo_url, created_at, created_by')
  if (error) {
    console.error('[module-sync-db] Failed to fetch custom modules:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    portfolio_path: r.portfolio_path,
    spun_off_repo_url: r.spun_off_repo_url ?? null,
    created_at: r.created_at,
    created_by: r.created_by ?? null,
  }))
}

/** Set of portfolio paths that are already registered (code-defined or custom). Used to exclude from scan. */
export async function getRegisteredPortfolioPaths(): Promise<Set<string>> {
  const codePaths = new Set(MODULE_SYNC_ENTRIES.map((m) => m.portfolioPath))
  const custom = await getCustomModulesFromDb()
  for (const c of custom) {
    codePaths.add(c.portfolio_path)
  }
  return codePaths
}

/** Return true if path is used by a code-defined module (reject when adding custom). */
export function isPortfolioPathCodeDefined(portfolioPath: string): boolean {
  const norm = portfolioPath.trim().replace(/\/+$/, '')
  return MODULE_SYNC_ENTRIES.some((m) => m.portfolioPath === norm || m.portfolioPath.replace(/\/+$/, '') === norm)
}

/** Return true if portfolioPath is already in code-defined list or in module_sync_custom. */
export async function isPortfolioPathRegistered(portfolioPath: string): Promise<boolean> {
  if (isPortfolioPathCodeDefined(portfolioPath)) return true
  const custom = await getCustomModulesFromDb()
  const norm = portfolioPath.trim().replace(/\/+$/, '')
  return custom.some((c) => c.portfolio_path === norm || c.portfolio_path.replace(/\/+$/, '') === norm)
}

/** Return module list: code-defined first (with DB config + suggested URL), then custom modules. Path is unique across both. */
export async function getModulesWithConfig(): Promise<ModuleSyncEntry[]> {
  const [dbConfig, customRows] = await Promise.all([
    getModuleSyncConfigFromDb(),
    getCustomModulesFromDb(),
  ])
  const parsed = parseGitHubRepoEnv(process.env.GITHUB_REPO)
  const owner = parsed?.owner

  let repoNameToUrl = new Map<string, string>()
  if (owner) {
    try {
      repoNameToUrl = await fetchOwnerRepos(owner)
    } catch (e) {
      console.warn('[module-sync-db] GitHub API fetch failed:', e)
    }
  }

  const codeDefined: ModuleSyncEntry[] = MODULE_SYNC_ENTRIES.map((m) => {
    const row = dbConfig.get(m.id)
    const spunOffRepoUrl = row?.spun_off_repo_url?.trim() || undefined
    const suggestedSpunOffRepoUrl =
      repoNameToUrl.get(m.id) ??
      (owner && m.id ? `https://github.com/${owner}/${m.id}` : undefined)
    return { ...m, spunOffRepoUrl, suggestedSpunOffRepoUrl }
  })

  const customEntries: ModuleSyncEntry[] = customRows.map((c) => ({
    id: c.id,
    name: c.name,
    portfolioPath: c.portfolio_path,
    spunOffRepoUrl: c.spun_off_repo_url?.trim() || undefined,
    suggestedSpunOffRepoUrl: owner ? `https://github.com/${owner}/${c.portfolio_path.split('/').pop() ?? c.id}` : undefined,
  }))

  return [...codeDefined, ...customEntries]
}

/** Upsert spun_off_repo_url for a module (code-defined → module_sync_config; custom → module_sync_custom). */
export async function setModuleSpunOffRepoUrl(
  moduleId: string,
  spunOffRepoUrl: string | null
): Promise<{ error?: string }> {
  if (!supabaseAdmin) {
    return { error: 'Server configuration error' }
  }
  const id = moduleId.trim()
  if (isCustomModuleId(id)) {
    const { error } = await supabaseAdmin
      .from('module_sync_custom')
      .update({
        spun_off_repo_url: spunOffRepoUrl?.trim() || null,
      })
      .eq('id', id)
    if (error) {
      if (error.code === 'PGRST116') return { error: `Unknown module: ${moduleId}` }
      console.error('[module-sync-db] Update custom module failed:', error)
      return { error: error.message }
    }
    return {}
  }
  const validId = MODULE_SYNC_ENTRIES.some((m) => m.id === id)
  if (!validId) {
    return { error: `Unknown module: ${moduleId}` }
  }
  const { error } = await supabaseAdmin
    .from('module_sync_config')
    .upsert(
      {
        module_id: id,
        spun_off_repo_url: spunOffRepoUrl?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'module_id' }
    )
  if (error) {
    console.error('[module-sync-db] Upsert failed:', error)
    return { error: error.message }
  }
  return {}
}

/** Update custom module name and/or spun_off_repo_url. */
export async function updateCustomModule(
  moduleId: string,
  updates: { name?: string; spunOffRepoUrl?: string | null }
): Promise<{ error?: string }> {
  if (!supabaseAdmin) return { error: 'Server configuration error' }
  if (!isCustomModuleId(moduleId.trim())) {
    return { error: `Not a custom module: ${moduleId}` }
  }
  const payload: { name?: string; spun_off_repo_url?: string | null } = {}
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.spunOffRepoUrl !== undefined) payload.spun_off_repo_url = updates.spunOffRepoUrl?.trim() || null
  if (Object.keys(payload).length === 0) return {}
  const { error } = await supabaseAdmin
    .from('module_sync_custom')
    .update(payload)
    .eq('id', moduleId.trim())
  if (error) {
    if (error.code === 'PGRST116') return { error: `Unknown module: ${moduleId}` }
    console.error('[module-sync-db] Update custom module failed:', error)
    return { error: error.message }
  }
  return {}
}

/** Delete custom module row only (does not delete the GitHub repo). */
export async function deleteCustomModule(moduleId: string): Promise<{ error?: string }> {
  if (!supabaseAdmin) return { error: 'Server configuration error' }
  if (!isCustomModuleId(moduleId.trim())) {
    return { error: `Not a custom module: ${moduleId}` }
  }
  const { error } = await supabaseAdmin
    .from('module_sync_custom')
    .delete()
    .eq('id', moduleId.trim())
  if (error) {
    if (error.code === 'PGRST116') return { error: `Unknown module: ${moduleId}` }
    console.error('[module-sync-db] Delete custom module failed:', error)
    return { error: error.message }
  }
  return {}
}

/** Get a single module entry by id (code-defined id or custom UUID) for diff/push. */
export async function getModuleEntryForDiff(moduleId: string): Promise<ModuleSyncEntry | null> {
  const modules = await getModulesWithConfig()
  return modules.find((m) => m.id === moduleId.trim()) ?? null
}
