/**
 * Module sync config — portfolio paths for each module.
 * Spun-off repo URL is stored in DB (module_sync_config) and set in Admin → Module Sync UI.
 */

export interface ModuleSyncEntry {
  id: string
  name: string
  /** Path under project root, e.g. client-templates/chatbot-template */
  portfolioPath: string
  /** Set from DB (Admin UI); used when running diff. */
  spunOffRepoUrl?: string
  /** Suggested URL: from GitHub API (repo name matches module id) or owner/moduleId when GITHUB_REPO is set. */
  suggestedSpunOffRepoUrl?: string
}

/** Default branch to compare against when diffing with GitHub (fallback if API doesn't return it). */
export const GITHUB_DEFAULT_BRANCH_FALLBACK = 'main'

/**
 * Modules that can be synced: template folders and n8n pack.
 * Spun-off repo URL is configured in the Admin UI and stored in module_sync_config.
 */
export const MODULE_SYNC_ENTRIES: ModuleSyncEntry[] = [
  {
    id: 'chatbot-template',
    name: 'Chatbot Template',
    portfolioPath: 'client-templates/chatbot-template',
  },
  {
    id: 'leadgen-template',
    name: 'Lead Generation Template',
    portfolioPath: 'client-templates/leadgen-template',
  },
  {
    id: 'eval-template',
    name: 'Eval Template',
    portfolioPath: 'client-templates/eval-template',
  },
  {
    id: 'diagnostic-template',
    name: 'Diagnostic Template',
    portfolioPath: 'client-templates/diagnostic-template',
  },
  {
    id: 'n8n-warm-lead-pack',
    name: 'n8n Warm Lead Pack',
    portfolioPath: 'n8n-exports',
  },
]

/** Paths to ignore when walking portfolio dir (e.g. node_modules, .git). */
export const MODULE_SYNC_IGNORE = new Set([
  'node_modules',
  '.git',
  '.next',
  '.cursor',
  'dist',
  'build',
])
