import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright-core'

const origin = process.env.PROTOTYPE_ORIGIN || 'http://127.0.0.1:5467'
const output = path.join(process.cwd(), 'docs/qa/service-prototypes/accelerated-cohort-workshop-mobile-walkthrough.mp4')
const frames = await fs.mkdtemp(path.join(os.tmpdir(), 'sam-mobile-walkthrough-'))
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
let index = 0
async function capture() {
  index += 1
  const filename = path.join(frames, `${String(index).padStart(2, '0')}.png`)
  await page.screenshot({ path: filename, animations: 'disabled' })
  return filename
}

try {
  await page.goto(`${origin}/service-prototypes/accelerated-cohort?view=1`, { waitUntil: 'networkidle' })
  await page.getByTestId('sam-artifact').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const files = [await capture()]
  const framework = page.getByRole('group', { name: 'Framework views' })
  for (const [act, control] of [['Signals', 'Questions'], ['Alignment', 'Roadmap'], ['Momentum', 'SudoPoll']]) {
    await framework.getByRole('button', { name: act }).click()
    const panel = page.locator(`[data-sam-act="${act.toLowerCase()}"]`)
    const image = panel.locator('[data-sam-plate] img')
    await image.evaluate((element) => element.decode())
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(400)
    files.push(await capture())
    const controlPanel = panel.locator('[class*=samControlPanel]')
    await controlPanel.scrollIntoViewIfNeeded()
    await panel.getByRole('button', { name: control }).click()
    await page.waitForTimeout(650)
    files.push(await capture())
  }
  await page.getByRole('button', { name: 'View original book artifact' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'View original book artifact' }).click()
  await page.waitForTimeout(500)
  files.push(await capture())
  const list = path.join(frames, 'frames.txt')
  const lines = files.flatMap((file) => [`file '${file}'`, 'duration 1.5'])
  lines.push(`file '${files.at(-1)}'`)
  await fs.writeFile(list, `${lines.join('\n')}\n`)
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=25,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-movflags', '+faststart', '-an', output], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ffmpeg exited with status ${result.status}`)
  console.log(output)
} finally {
  await browser.close()
  await fs.rm(frames, { recursive: true, force: true })
}
