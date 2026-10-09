import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4187'
const baseOrigin = new URL(baseUrl).origin
const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN
const outputDir = path.join(process.cwd(), 'docs', 'qa', 'revenue-plumbing-home-card')
const rawVideoDir = path.join(process.cwd(), 'test-results', 'revenue-plumbing-home-card', 'raw')
const targetPath = '/insights/revenue-plumbing-map'
const cardCopy = 'An interactive AmaduTown operating model for finding where revenue systems leak capacity.'

fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(rawVideoDir, { recursive: true })

function convertToMp4(webmPath, mp4Path) {
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    webmPath,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4Path,
  ], { stdio: 'pipe' })
}

async function protectPrivacy(context, blockedExternalRequests) {
  await context.route('**/*', async (route) => {
    const requestUrl = new URL(route.request().url())

    if (requestUrl.origin !== baseOrigin && !['data:', 'blob:'].includes(requestUrl.protocol)) {
      blockedExternalRequests.push(requestUrl.href)
      await route.abort()
      return
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      const body = requestUrl.pathname === '/api/campaigns/active' ? { data: [] } : []
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
      return
    }

    await route.continue()
  })
}

async function inspectViewport(browser, name, viewport) {
  const blockedExternalRequests = []
  const context = await browser.newContext({
    viewport,
    colorScheme: 'light',
    extraHTTPHeaders: vercelOidcToken
      ? { 'x-vercel-trusted-oidc-idp-token': vercelOidcToken }
      : undefined,
  })
  await protectPrivacy(context, blockedExternalRequests)
  const page = await context.newPage()

  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const card = page.getByRole('link', { name: /Revenue Plumbing Map/i })
  await expect(card).toHaveAttribute('href', targetPath)
  await expect(page.getByText(cardCopy)).toBeVisible()
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  const screenshotPath = path.join(outputDir, `homepage-card-${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false })

  const layout = await card.evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return {
      card: {
        bottom: Math.round(bounds.bottom),
        height: Math.round(bounds.height),
        left: Math.round(bounds.left),
        right: Math.round(bounds.right),
        top: Math.round(bounds.top),
        width: Math.round(bounds.width),
      },
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.card.left).toBeGreaterThanOrEqual(0)
  expect(layout.card.right).toBeLessThanOrEqual(layout.viewportWidth)

  await card.click()
  await page.waitForURL((url) => url.pathname === targetPath)
  await expect(page.getByRole('heading', { name: 'Your revenue has a plumbing problem' })).toBeVisible()

  const mapSection = page.getByRole('region', { name: 'Interactive revenue plumbing map' })
  await mapSection.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -96))
  await page.waitForTimeout(500)
  const mapScreenshotPath = path.join(outputDir, `map-light-${name}.png`)
  await mapSection.screenshot({ path: mapScreenshotPath })

  const theme = await page.getByTestId('revenue-map-canvas').evaluate((element) => {
    const styles = getComputedStyle(element)
    return {
      backgroundColor: styles.backgroundColor,
      borderColor: styles.borderColor,
    }
  })

  await context.close()

  return {
    name,
    viewport,
    screenshot: path.relative(process.cwd(), screenshotPath),
    mapScreenshot: path.relative(process.cwd(), mapScreenshotPath),
    destination: targetPath,
    layout,
    theme,
    externalRequests: [],
    blockedExternalRequests,
  }
}

async function captureDarkMap(browser) {
  const blockedExternalRequests = []
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    extraHTTPHeaders: vercelOidcToken
      ? { 'x-vercel-trusted-oidc-idp-token': vercelOidcToken }
      : undefined,
  })
  await protectPrivacy(context, blockedExternalRequests)
  const page = await context.newPage()
  await page.addInitScript(() => window.localStorage.setItem('theme', 'dark'))
  await page.goto(`${baseUrl}${targetPath}`, { waitUntil: 'networkidle' })

  const mapSection = page.getByRole('region', { name: 'Interactive revenue plumbing map' })
  await mapSection.scrollIntoViewIfNeeded()
  await page.evaluate(() => window.scrollBy(0, -96))
  await page.waitForTimeout(500)
  const screenshotPath = path.join(outputDir, 'map-dark-desktop-1440.png')
  await mapSection.screenshot({ path: screenshotPath })

  const theme = await page.getByTestId('revenue-map-canvas').evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
  }))
  await context.close()

  return {
    screenshot: path.relative(process.cwd(), screenshotPath),
    theme,
    externalRequests: [],
    blockedExternalRequests,
  }
}

async function recordWalkthrough(browser) {
  const blockedExternalRequests = []
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    recordVideo: { dir: rawVideoDir, size: { width: 1440, height: 900 } },
    extraHTTPHeaders: vercelOidcToken
      ? { 'x-vercel-trusted-oidc-idp-token': vercelOidcToken }
      : undefined,
  })
  await protectPrivacy(context, blockedExternalRequests)
  const page = await context.newPage()

  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  const card = page.getByRole('link', { name: /Revenue Plumbing Map/i })
  await card.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1800)
  await card.click()
  await page.waitForURL((url) => url.pathname === targetPath)
  await expect(page.getByRole('heading', { name: 'Your revenue has a plumbing problem' })).toBeVisible()
  await page.getByRole('region', { name: 'Interactive revenue plumbing map' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(2200)

  const video = page.video()
  await context.close()
  const webmPath = await video.path()
  const mp4Path = path.join(outputDir, 'homepage-card-walkthrough.mp4')
  convertToMp4(webmPath, mp4Path)

  return {
    video: path.relative(process.cwd(), mp4Path),
    destination: targetPath,
    externalRequests: [],
    blockedExternalRequests,
  }
}

const browser = await chromium.launch({ headless: true })

try {
  const viewports = []
  for (const [name, viewport] of [
    ['mobile-390', { width: 390, height: 844 }],
    ['tablet-768', { width: 768, height: 900 }],
    ['desktop-1440', { width: 1440, height: 900 }],
  ]) {
    viewports.push(await inspectViewport(browser, name, viewport))
  }

  const walkthrough = await recordWalkthrough(browser)
  const darkMode = await captureDarkMap(browser)
  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    route: '/',
    destination: targetPath,
    copy: cardCopy,
    viewports,
    walkthrough,
    darkMode,
    externalRequests: [],
    blockedExternalRequests: [...new Set([
      ...viewports.flatMap((result) => result.blockedExternalRequests),
      ...walkthrough.blockedExternalRequests,
      ...darkMode.blockedExternalRequests,
    ])],
  }

  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  console.log(JSON.stringify(manifest, null, 2))
} finally {
  await browser.close()
}
