/**
 * Capture screenshots and short video clips for the about-page video storyboard.
 * Writes to design-files/about-page-video/.
 *
 * If the dev server is not running at BASE_URL, the script will start it (npm run dev) and wait
 * for it to be ready before capturing. Set BASE_URL to use a different origin (e.g. production).
 *
 * Admin routes (/admin, /admin/module-sync, /admin/chat-eval) require login. The script
 * automatically generates auth state when ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD are set in
 * .env.local. You can also pass STORYBOARD_AUTH_STATE explicitly to use a pre-built state file.
 *
 * Usage: npx tsx scripts/capture-storyboard-assets.ts [--videos] [--no-start-server]
 *   --videos          Also record a short (4s) clip per route (WebM). Uses full 1920x1080.
 *   --no-start-server Do not auto-start the dev server; fail if BASE_URL is unreachable.
 *
 * Env:
 *   STORYBOARD_AUTH_STATE   Path to a Playwright storage-state JSON file (overrides auto-gen).
 *   ADMIN_E2E_EMAIL         Admin email — used to auto-generate auth state if STORYBOARD_AUTH_STATE is not set.
 *   ADMIN_E2E_PASSWORD      Admin password — used with ADMIN_E2E_EMAIL.
 */

import { config } from 'dotenv'
import * as path from 'path'
config({ path: path.join(process.cwd(), '.env.local') })

import { captureBroll, DEFAULT_ROUTES } from '@/lib/playtest-broll'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = path.join(process.cwd(), 'design-files', 'about-page-video')

async function main() {
  const recordVideos = process.argv.includes('--videos')
  const noStartServer = process.argv.includes('--no-start-server')

  const result = await captureBroll({
    routes: DEFAULT_ROUTES,
    outputDir: OUT_DIR,
    recordVideos,
    baseUrl: BASE_URL,
    noStartServer,
    authStateOutPath: path.join(OUT_DIR, '.storyboard-auth-state.json'),
  })

  console.log('Done. Assets in', result.outputDir)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
