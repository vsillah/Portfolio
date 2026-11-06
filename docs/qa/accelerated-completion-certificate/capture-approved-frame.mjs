import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const output = dirname(fileURLToPath(import.meta.url))
const baseUrl = process.env.QA_URL || 'http://localhost:3158/member/dashboard?qa=completion-ready&rev=profile-name-prefill'
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ headless: true })

async function claim(page) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const input = page.getByRole('textbox', { name: 'Name on certificate' })
  if (await input.inputValue() !== 'Course Learner') throw new Error('Synthetic profile name was not prefilled')
  await page.getByRole('button', { name: 'Claim certificate' }).click()
  await page.getByLabel('Claimed Accelerated completion certificate').waitFor()
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
await desktop.goto(baseUrl, { waitUntil: 'networkidle' })
await desktop.getByLabel('Unclaimed Accelerated completion certificate preview').screenshot({ path: join(output, 'profile-name-prefill.png') })
await claim(desktop)
await desktop.getByLabel('Claimed Accelerated completion certificate').screenshot({ path: join(output, 'approved-frame-desktop.png') })

const download = desktop.waitForEvent('download')
await desktop.getByRole('button', { name: 'Download certificate' }).click()
const svgPath = join(output, 'approved-frame-download.svg')
await (await download).saveAs(svgPath)
const downloaded = await browser.newPage({ viewport: { width: 1424, height: 1104 }, deviceScaleFactor: 1 })
const svg = await readFile(svgPath, 'utf8')
await downloaded.setContent(
  `<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style></head><body>${svg}</body></html>`,
  { waitUntil: 'load' },
)
await downloaded.screenshot({ path: join(output, 'approved-frame-download.png') })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await claim(mobile)
await mobile.getByLabel('Claimed Accelerated completion certificate').screenshot({ path: join(output, 'approved-frame-mobile.png') })

await browser.close()
