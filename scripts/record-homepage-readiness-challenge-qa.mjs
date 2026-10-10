import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium, expect } from '@playwright/test'

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4189'
const baseOrigin = new URL(baseUrl).origin
const vercelOidcToken = process.env.VERCEL_OIDC_TOKEN
const outputDir = path.join(process.cwd(), 'docs', 'qa', 'homepage-readiness-challenge')
const rawVideoDir = path.join(process.cwd(), 'test-results', 'homepage-readiness-challenge', 'raw')
const challengePath = '/campaigns/agentic-operating-system-readiness-challenge'

const challenge = {
  id: 'qa-agentic-readiness',
  name: 'Agentic Operating System Readiness Challenge',
  slug: 'agentic-operating-system-readiness-challenge',
  description: 'Find the gaps between your agent ambition and operating reality.',
  campaign_type: 'free_challenge',
  status: 'active',
  hero_image_url: null,
  promo_copy: 'Assess the operating foundations your agents need before you scale them.',
  enrollment_deadline: null,
  completion_window_days: 7,
  payout_type: 'credit',
  payout_amount_type: 'fixed',
  campaign_eligible_bundles: [],
  campaign_criteria_templates: [
    {
      id: 'qa-criterion',
      label_template: 'Map one high-friction workflow',
      description_template: 'Name the owner, inputs, handoffs, and proof of completion.',
      criteria_type: 'action',
      required: true,
      display_order: 1,
    },
  ],
}

const products = [
  {
    id: 901,
    title: 'Agent Ops Field Guide',
    description: 'A practical guide for shaping accountable human-and-agent workflows.',
    type: 'ebook',
    price: 0,
    image_url: null,
    image_variants: null,
    is_featured: true,
  },
  {
    id: 902,
    title: 'Workflow Readiness Template',
    description: 'A reusable template for documenting decisions, owners, and operating evidence.',
    type: 'template',
    price: 24,
    image_url: null,
    image_variants: null,
    is_featured: false,
  },
]

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

    if (requestUrl.pathname === '/api/campaigns/active') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [challenge] }) })
      return
    }

    if (requestUrl.pathname === challengePath.replace('/campaigns/', '/api/campaigns/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: challenge }) })
      return
    }

    if (requestUrl.pathname === '/api/products') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(products) })
      return
    }

    if (requestUrl.pathname.startsWith('/api/')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
      return
    }

    await route.continue()
  })
}

async function openCatalog(browser, { name, viewport, colorScheme, recordVideo = false }) {
  const blockedExternalRequests = []
  const context = await browser.newContext({
    viewport,
    colorScheme,
    recordVideo: recordVideo ? { dir: rawVideoDir, size: viewport } : undefined,
    extraHTTPHeaders: vercelOidcToken
      ? { 'x-vercel-trusted-oidc-idp-token': vercelOidcToken }
      : undefined,
  })
  await protectPrivacy(context, blockedExternalRequests)
  const page = await context.newPage()
  await page.addInitScript((theme) => window.localStorage.setItem('theme', theme), colorScheme)
  await page.goto(baseUrl, { waitUntil: 'networkidle' })

  const productsSection = page.locator('section#products')
  const challengeCard = productsSection.getByRole('link', { name: /Agentic Operating System Readiness Challenge/i })
  const productCard = productsSection.getByRole('link', { name: /Agent Ops Field Guide/i })

  await expect(productsSection.getByRole('heading', { name: 'Products' })).toBeVisible()
  await expect(challengeCard).toHaveAttribute('href', challengePath)
  await expect(challengeCard.getByText('Free Challenge')).toBeVisible()
  await expect(challengeCard.getByText('View Challenge')).toBeVisible()
  await challengeCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(recordVideo ? 1400 : 350)

  const layout = await page.evaluate(() => {
    const section = document.querySelector('section#products')
    const cards = Array.from(section?.querySelectorAll('a.group') || []).slice(0, 2)
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      cards: cards.map((card) => {
        const bounds = card.getBoundingClientRect()
        const styles = getComputedStyle(card)
        return {
          left: Math.round(bounds.left),
          right: Math.round(bounds.right),
          top: Math.round(bounds.top),
          width: Math.round(bounds.width),
          backgroundColor: styles.backgroundColor,
          borderColor: styles.borderColor,
        }
      }),
    }
  })

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
  expect(layout.cards).toHaveLength(2)
  for (const card of layout.cards) {
    expect(card.left).toBeGreaterThanOrEqual(0)
    expect(card.right).toBeLessThanOrEqual(layout.viewportWidth)
  }
  if (viewport.width >= 768) {
    expect(Math.abs(layout.cards[0].width - layout.cards[1].width)).toBeLessThanOrEqual(1)
  }

  const screenshotPath = path.join(outputDir, `${name}-${colorScheme}.png`)
  await productsSection.screenshot({ path: screenshotPath })

  let videoPath = null
  if (recordVideo) {
    await productCard.hover()
    await page.waitForTimeout(700)
    await challengeCard.hover()
    await page.waitForTimeout(900)
    await challengeCard.click()
    await page.waitForURL((url) => url.pathname === challengePath)
    await expect(page.getByRole('heading', { name: challenge.name })).toBeVisible()
    await page.waitForTimeout(1600)

    const video = page.video()
    await context.close()
    const webmPath = await video.path()
    videoPath = path.join(outputDir, `${name}-walkthrough.mp4`)
    convertToMp4(webmPath, videoPath)
  } else {
    await context.close()
  }

  return {
    name,
    viewport,
    colorScheme,
    route: '/',
    destination: challengePath,
    screenshot: path.relative(process.cwd(), screenshotPath),
    video: videoPath ? path.relative(process.cwd(), videoPath) : null,
    layout,
    externalRequests: [],
    blockedExternalRequests,
  }
}

const browser = await chromium.launch({ headless: true })

try {
  const runs = []
  runs.push(await openCatalog(browser, {
    name: 'mobile-390',
    viewport: { width: 390, height: 844 },
    colorScheme: 'light',
    recordVideo: true,
  }))
  runs.push(await openCatalog(browser, {
    name: 'tablet-768',
    viewport: { width: 768, height: 900 },
    colorScheme: 'light',
  }))
  runs.push(await openCatalog(browser, {
    name: 'desktop-1440',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'light',
    recordVideo: true,
  }))
  runs.push(await openCatalog(browser, {
    name: 'desktop-1440',
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  }))

  const manifest = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    privacy: 'Synthetic campaign and product fixtures; all external requests blocked.',
    runs,
    externalRequests: [],
    blockedExternalRequests: [...new Set(runs.flatMap((run) => run.blockedExternalRequests))],
  }

  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify(manifest, null, 2))
} finally {
  await browser.close()
}
