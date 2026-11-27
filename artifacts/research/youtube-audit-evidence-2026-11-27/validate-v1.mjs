import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ownDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(ownDir, '../../..')
const bundle = resolve(ownDir, 'v1')
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const requiredGaps = [
  'homepage_privacy_link_and_youtube_branding_same_live_route',
  'privacy_browser_address_bar',
  'oauth_consent_scopes_revocation_screenshots',
  'authenticated_upload_interface_screenshot',
  'authenticated_internal_dashboard_screenshot',
  'complete_upload_script_or_end_to_end_live_youtube_outcome',
]

export function validate(manifest = JSON.parse(readFileSync(resolve(bundle, 'manifest.json'), 'utf8'))) {
  const errors = []
  const add = (condition, message) => { if (!condition) errors.push(message) }
  add(manifest.schema === 'portfolio-youtube-audit-evidence/v1' &&
    manifest.state === 'review_only_incomplete_unsubmitted' &&
    manifest.frozen_source_commit === 'a9c4ea9f0cf2f7cf3454a89e569ee3f748d68585', 'Packet identity or state drifted')
  add(manifest.project_id === 'amadutown-advisory-solutions' &&
    manifest.project_number === '329708734708' && manifest.client === 'Portfolio', 'Project/client binding drifted')
  add(manifest.form_url === 'https://support.google.com/youtube/contact/yt_api_form?hl=en', 'Form binding drifted')
  for (const key of ['form_state_modified', 'uploaded', 'submitted', 'amendment_accepted', 'attestations_accepted', 'provider_write', 'production_data_write']) {
    add(manifest[key] === false, `${key} was promoted`)
  }
  add(requiredGaps.every(gap => manifest.unresolved_required_evidence?.includes(gap)), 'Required evidence gap was hidden')
  const paths = new Set()
  for (const entry of manifest.files ?? []) {
    add(typeof entry.path === 'string' && !entry.path.includes('..') && !entry.path.startsWith('/'), 'Unsafe artifact path')
    if (typeof entry.path !== 'string' || entry.path.includes('..') || entry.path.startsWith('/')) continue
    add(!paths.has(entry.path), `Duplicate artifact: ${entry.path}`)
    paths.add(entry.path)
    const path = resolve(bundle, entry.path)
    try {
      add(digest(path) === entry.sha256 && statSync(path).size === entry.bytes, `Artifact hash/size drift: ${entry.path}`)
    } catch { errors.push(`Artifact missing: ${entry.path}`) }
    add(typeof entry.form_mapping === 'string' && typeof entry.provenance === 'string' &&
      typeof entry.redaction_status === 'string' && typeof entry.rights_status === 'string' &&
      typeof entry.status === 'string', `Artifact metadata missing: ${entry.path}`)
  }
  add(paths.size === 8, 'Evidence inventory size drifted')
  for (const [path, expected] of Object.entries(manifest.source_sha256 ?? {})) {
    add(!path.includes('..') && !path.startsWith('/'), `Unsafe source path: ${path}`)
    if (path.includes('..') || path.startsWith('/')) continue
    try { add(digest(resolve(root, path)) === expected, `Source hash drift: ${path}`) }
    catch { errors.push(`Source missing: ${path}`) }
  }
  add(Object.keys(manifest.source_sha256 ?? {}).length === 7, 'Source inventory size drifted')
  return { status: errors.length ? 'blocked' : manifest.state, errors }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validate()
  console.log(JSON.stringify(result))
  if (result.errors.length) process.exitCode = 1
}
