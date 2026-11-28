import { chromium } from '@playwright/test'
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:3128'
const revision = process.env.QA_REVISION || 'working-tree'
const authState = process.env.PLAYWRIGHT_AUTH_STATE || '/Users/vambahsillah/Projects/Portfolio/.auth/portfolio-admin-storage-state.json'
const outputDir = path.resolve(process.env.QA_OUTPUT_DIR || 'artifacts/provider-evidence/youtube-api-audit-2026-11-27/screencast')
const evidenceRoot = path.resolve('artifacts/provider-evidence/youtube-api-audit-2026-11-27')
const diagramDir = path.join(evidenceRoot, 'diagrams')
const rawVideoDir = path.join(outputDir, 'raw-video')
const mp4Path = path.join(outputDir, 'portfolio-youtube-internal-workflow.mp4')
const route = '/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef'
const reviewUrl = `${baseUrl}${route}?step=visuals&review=mobile&qa_fixture=channel_native_video_v2&video_package_state=ready&packaging_state=bound&rev=${encodeURIComponent(revision)}`
const architecturePath = path.join(diagramDir, 'portfolio-youtube-architecture.svg')
const userFlowPath = path.join(diagramDir, 'portfolio-youtube-user-flow.svg')
const architecturePngPath = path.join(diagramDir, 'portfolio-youtube-architecture.png')
const userFlowPngPath = path.join(diagramDir, 'portfolio-youtube-user-flow.png')
const architectureSvg = await readFile(architecturePath, 'utf8')
const userFlowSvg = await readFile(userFlowPath, 'utf8')
const blockedRequests = []
const unexpectedLocalWrites = []

const sha256 = async (filePath) => createHash('sha256').update(await readFile(filePath)).digest('hex')

await mkdir(rawVideoDir, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  storageState: authState,
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
  colorScheme: 'dark',
})
const page = await context.newPage()
const recording = page.video()

await page.route('**/*', async (requestRoute) => {
  const request = requestRoute.request()
  const url = new URL(request.url())
  const isLocal = ['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'file:'
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(request.method())
  if (!isLocal || !isRead) {
    const target = isLocal
      ? 'local_write'
      : url.pathname.startsWith('/auth/')
        ? 'supabase_auth'
        : url.pathname.includes('speed-insights')
          ? 'vercel_speed_insights'
          : 'external_service'
    blockedRequests.push({ method: request.method(), target })
    if (isLocal && !isRead) unexpectedLocalWrites.push({ method: request.method(), pathname: url.pathname })
    return requestRoute.abort('blockedbyclient')
  }
  return requestRoute.continue()
})

const savedState = JSON.parse(await readFile(authState, 'utf8'))
const savedLocalStorage = savedState.origins?.flatMap((entry) => entry.localStorage ?? []) ?? []
await page.addInitScript((entries) => {
  for (const entry of entries) localStorage.setItem(entry.name, entry.value)
}, savedLocalStorage)

await page.goto(reviewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
const packaging = page.getByLabel('YouTube Shorts packaging evidence')
await packaging.waitFor({ state: 'visible' })
await packaging.scrollIntoViewIfNeeded()
const renderedStatus = (await packaging.getByRole('status').first().innerText()).trim()
console.log(`Rendered packaging status: ${renderedStatus}`)
if (!['Asset-package evidence ready', 'Pair binding passed · scoring hold'].includes(renderedStatus)) {
  throw new Error(`Expected the approved bound fixture, received: ${renderedStatus}`)
}
await page.waitForTimeout(1800)

await packaging.getByText('Title evidence', { exact: true }).click()
await packaging.getByText('Formula and decision logic', { exact: true }).first().waitFor({ state: 'visible' })
await page.waitForTimeout(1800)

await packaging.getByText('Thumbnail evidence', { exact: true }).click()
await page.waitForTimeout(1400)
await packaging.getByText('Visual-neighbor comparison and source map', { exact: true }).click()
const cohort = packaging.getByTestId('youtube-thumbnail-research-cohort')
await cohort.getByText('9:16 candidate · 3 first-party · 8 live topic sources', { exact: true }).waitFor({ state: 'visible' })
await page.waitForTimeout(2200)

await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#071421;width:100%;height:100%;display:grid;place-items:center}svg{width:100%;height:100%;object-fit:contain}</style></head><body>${architectureSvg}</body></html>`, { waitUntil: 'load' })
await page.waitForTimeout(3200)
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#071421;width:100%;height:100%;display:grid;place-items:center}svg{width:100%;height:100%;object-fit:contain}</style></head><body>${userFlowSvg}</body></html>`, { waitUntil: 'load' })
await page.waitForTimeout(3200)
await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#071421;color:#f8fafc;font-family:Inter,Arial,sans-serif;height:100%;display:grid;place-items:center}.card{width:980px;border:2px solid #ff6b6b;border-radius:28px;padding:56px;background:#481f29;text-align:center}h1{font-size:42px;margin:0 0 26px}p{font-size:24px;line-height:1.55;margin:12px}.ok{color:#b2f2bb;font-weight:700}</style></head><body><section class="card"><h1>Review-only boundary reached</h1><p class="ok">Internal candidate, evidence, and Human QA path demonstrated.</p><p>No credential was displayed or persisted.</p><p>No provider request, upload, scheduling, publication, scoring activation, collection activation, or production write occurred.</p><p>Live YouTube execution remains behind a separate explicit authority gate.</p></section></body></html>`)
await page.waitForTimeout(3200)

await context.close()
await browser.close()
const rawPath = await recording?.path()
if (!rawPath) throw new Error('Playwright did not produce a workflow recording.')
const webmPath = path.join(outputDir, 'portfolio-youtube-internal-workflow.webm')
await rename(rawPath, webmPath)
await execFileAsync('ffmpeg', ['-y', '-i', webmPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4Path])
await unlink(webmPath)

if (unexpectedLocalWrites.length) throw new Error(`Unexpected local write requests: ${JSON.stringify(unexpectedLocalWrites)}`)

const receipt = {
  version: 'portfolio-youtube-provider-internal-workflow/v1',
  revision,
  review_url: reviewUrl,
  data_mode: 'approved_fixture_and_static_governance_diagrams',
  rendered_status: renderedStatus,
  scope: 'review_only_internal_tool_screencast',
  mp4: path.relative(process.cwd(), mp4Path),
  mp4_sha256: await sha256(mp4Path),
  architecture_diagram: path.relative(process.cwd(), architecturePath),
  architecture_sha256: await sha256(architecturePath),
  architecture_png: path.relative(process.cwd(), architecturePngPath),
  architecture_png_sha256: await sha256(architecturePngPath),
  user_flow_diagram: path.relative(process.cwd(), userFlowPath),
  user_flow_sha256: await sha256(userFlowPath),
  user_flow_png: path.relative(process.cwd(), userFlowPngPath),
  user_flow_png_sha256: await sha256(userFlowPngPath),
  external_requests_blocked: blockedRequests,
  external_requests_completed: 0,
  local_write_requests_completed: 0,
  credentials_returned_or_persisted: false,
  provider_settings_changed: false,
  production_data_mutated: false,
  scoring_activated: false,
  collection_activated: false,
  evidence_linked: false,
  upload_attempted: false,
  schedule_attempted: false,
  publication_attempted: false,
  attestations_accepted: false,
  captcha_solved: false,
  provider_form_submitted: false,
  limitation: 'This recording truthfully demonstrates the internal Portfolio workflow and its fail-closed provider boundary. It does not claim or simulate a live YouTube upload.',
}
await writeFile(path.join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`)
console.log(JSON.stringify(receipt, null, 2))
