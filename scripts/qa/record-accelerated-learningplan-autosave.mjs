import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3211'
const revision = process.env.QA_REVISION || execFileSync('git', ['rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim()
const output = path.resolve('docs/qa/accelerated-learningplan-noop-autosave')
const raw = path.join(output, 'raw')
mkdirSync(raw, { recursive: true })

const user = { id: 'synthetic-member', email: 'member@example.test', user_metadata: { full_name: 'Synthetic Member' }, aud: 'authenticated', role: 'authenticated' }
const fixtureUrl = `${baseUrl}/accelerated/learningplan?fixture=synthetic-member-autosave&rev=${revision}`
const runs = []
const browser = await chromium.launch({ headless: true })

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  let currentRevision = 12
  const posts = []
  const context = await browser.newContext({ viewport, colorScheme: 'dark', recordVideo: { dir: raw, size: viewport }, serviceWorkers: 'block' })
  await context.addInitScript((syntheticUser) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-local-token', refresh_token: 'synthetic-local-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user: syntheticUser }))
  }, user)
  const page = await context.newPage()
  await page.route('**/api/accelerated/member', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      posts.push({ action: body.action, expectedRevision: body.expectedRevision, answer: body.state?.worksheet?.answers?.L01 })
      currentRevision += 1
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ saved: true, revision: currentRevision, replay: false }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      version: 'accelerated-l01-l16-ed73dee7', profileName: 'Synthetic Member',
      enrollment: { revision: currentRevision, current_lesson_id: 'L01' }, lessons: [],
      worksheet: { worksheet_id: '22345678-1234-4234-8234-123456789abc', answers: { L01: 'Saved synthetic answer' }, updated_at: '2026-11-01T00:00:00Z' },
    }) })
  })
  await page.route('**/api/accelerated/member/credential', async (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: false }) }))
  const status = async (stage) => {
    await page.evaluate(({ stage, revisionValue, postCount }) => {
      document.getElementById('qa-autosave-status')?.remove()
      const panel = document.createElement('div')
      panel.id = 'qa-autosave-status'
      panel.setAttribute('role', 'note')
      panel.textContent = `SYNTHETIC MEMBER QA · ${stage} · revision ${revisionValue} · member POST ${postCount}`
      panel.style.cssText = 'position:fixed;z-index:2147483647;bottom:12px;left:12px;right:12px;max-width:900px;padding:12px 16px;background:#fff;color:#111;font:700 16px/1.35 system-ui;border:3px solid #e6b84f;border-radius:8px;box-shadow:0 3px 15px #0008'
      document.body.append(panel)
    }, { stage, revisionValue: currentRevision, postCount: posts.length })
  }
  const answer = page.getByRole('textbox', { name: 'Your response to this lesson' })
  await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Open dashboard' }).waitFor()
  await answer.scrollIntoViewIfNeeded()
  if (await answer.inputValue() !== 'Saved synthetic answer') throw new Error(`${label}: remote worksheet did not hydrate`)
  await status('hydrated from GET')
  await page.screenshot({ path: path.join(output, `${label}-hydrated.png`) })
  await page.waitForTimeout(1500)
  if (posts.length || await page.getByText('Saving this lesson and worksheet to your profile…').count()) throw new Error(`${label}: hydration caused autosave`)
  await status('no write after debounce')
  await page.waitForTimeout(700)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('link', { name: 'Open dashboard' }).waitFor()
  await answer.scrollIntoViewIfNeeded()
  await status('reloaded from GET')
  await page.waitForTimeout(1500)
  if (posts.length || await page.getByText('Saving this lesson and worksheet to your profile…').count()) throw new Error(`${label}: reload caused autosave`)
  await status('reload stayed read-only')
  await page.waitForTimeout(700)
  await answer.fill('One real synthetic edit')
  await status('learner edited answer')
  await page.waitForTimeout(1500)
  if (posts.length !== 1 || posts[0].expectedRevision !== 12 || posts[0].answer !== 'One real synthetic edit' || currentRevision !== 13) throw new Error(`${label}: expected exactly one revision-guarded save, got ${JSON.stringify(posts)}`)
  await status('one edit → one save')
  await page.screenshot({ path: path.join(output, `${label}-saved.png`) })
  await page.waitForTimeout(900)
  const video = page.video()
  await context.close()
  const mp4 = path.join(output, `${label}-walkthrough.mp4`)
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', await video.path(), '-c:v', 'libx264', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4])
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', mp4], { encoding: 'utf8' }))
  if (probe.streams[0]?.codec_name !== 'h264' || Number(probe.format.duration) < 5) throw new Error(`${label}: invalid MP4`)
  execFileSync('ffmpeg', ['-v', 'error', '-i', mp4, '-f', 'null', '-'], { stdio: 'ignore' })
  runs.push({ label, viewport, fixtureUrl, initialRevision: 12, finalRevision: currentRevision, memberPosts: posts, mp4: path.relative(process.cwd(), mp4), durationSeconds: Number(probe.format.duration) })
}
await browser.close()
writeFileSync(path.join(output, 'results.json'), `${JSON.stringify({ captureRevision: revision, runs }, null, 2)}\n`)
console.log(JSON.stringify({ captureRevision: revision, runs }, null, 2))
