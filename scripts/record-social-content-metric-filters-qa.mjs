import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from '@playwright/test'

const baseUrl = process.env.QA_BASE_URL || 'http://localhost:3098'
const outputDir = path.join(process.cwd(), 'test-results', 'social-content-metric-filters')
const videoDir = path.join(outputDir, 'raw')
const manifestPath = path.join(outputDir, 'manifest.json')

function readEnvValue(key) {
  for (const file of ['.env.local', '.env']) {
    const filePath = path.join(process.cwd(), file)
    if (!fs.existsSync(filePath)) continue
    const match = fs.readFileSync(filePath, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  }
  return process.env[key] || ''
}

function authStorageKey() {
  const supabaseUrl = readEnvValue('NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required to prepare local auth storage.')
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  return `sb-${projectRef}-auth-token`
}

function itemForStatus(status, index = 1) {
  return {
    id: `qa-${status}-${index}`,
    meeting_record_id: null,
    platform: index % 2 === 0 ? 'x' : 'linkedin',
    status,
    post_text: `${status} QA content item ${index}`,
    cta_text: null,
    cta_url: null,
    hashtags: ['#AgentOps'],
    image_url: null,
    image_prompt: null,
    framework_visual_type: null,
    voiceover_url: null,
    voiceover_text: null,
    video_url: null,
    topic_extracted: { topic: `${status} metric filter QA` },
    hormozi_framework: null,
    rag_context: {},
    scheduled_for: status === 'scheduled' ? '2026-09-18T14:00:00.000Z' : null,
    published_at: status === 'published' ? '2026-09-19T14:00:00.000Z' : null,
    platform_post_id: null,
    admin_notes: null,
    reviewed_by: null,
    target_platforms: ['linkedin'],
    video_generation_method: 'none',
    youtube_title: null,
    youtube_description: null,
    created_at: `2026-09-0${index}T12:00:00.000Z`,
    updated_at: `2026-09-0${index}T12:00:00.000Z`,
  }
}

const allItems = [
  itemForStatus('draft', 1),
  itemForStatus('draft', 2),
  itemForStatus('approved', 1),
  itemForStatus('scheduled', 1),
  itemForStatus('published', 1),
  itemForStatus('rejected', 1),
]

const stats = {
  draft: 2,
  approved: 1,
  scheduled: 1,
  published: 1,
  rejected: 1,
  total: allItems.length,
}

async function installFixtures(context, externalRequests, suppressedExternalScripts) {
  const baseOrigin = new URL(baseUrl).origin
  const storageKey = authStorageKey()
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60
  const fakeSession = {
    access_token: 'qa-admin-token',
    refresh_token: 'qa-refresh-token',
    expires_in: 3600,
    expires_at: expiresAt,
    token_type: 'bearer',
    user: {
      id: 'qa-admin-user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'qa-admin@example.test',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-09-01T12:00:00.000Z',
    },
  }

  await context.addInitScript(({ baseOrigin: origin, storageKey: key, session }) => {
    if (window.location.origin === origin) {
      window.localStorage.setItem(key, JSON.stringify(session))
    }
    const nativeFetch = window.fetch.bind(window)
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const parsedUrl = new URL(url, window.location.href)
      if (parsedUrl.pathname.endsWith('/auth/v1/user')) {
        return new Response(JSON.stringify({ user: session.user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (parsedUrl.pathname.endsWith('/auth/v1/token')) {
        return new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return nativeFetch(input, init)
    }
  }, { baseOrigin, storageKey, session: fakeSession })

  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url())
    if (url.hostname === 'va.vercel-scripts.com') {
      suppressedExternalScripts.push(url.href)
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      })
      return
    }

    if (url.origin !== baseOrigin && url.protocol !== 'data:') {
      externalRequests.push(url.href)
      await route.abort()
      return
    }

    if (url.pathname === '/api/user/profile') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: 'qa-admin-user',
            email: 'qa-admin@example.test',
            role: 'admin',
            created_at: '2026-09-01T12:00:00.000Z',
            updated_at: '2026-09-01T12:00:00.000Z',
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/admin/social-content/config') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configs: [] }),
      })
      return
    }

    if (url.pathname === '/api/admin/social-content/runs') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ runs: [], summary: { running: 0, failed: 0, completed: 0 } }),
      })
      return
    }

    if (url.pathname === '/api/admin/social-content') {
      const status = url.searchParams.get('status')
      const items = status ? allItems.filter((item) => item.status === status) : allItems
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items,
          stats,
          lastExtractionRun: null,
          pagination: {
            page: 1,
            limit: 20,
            total: items.length,
            totalPages: 1,
          },
        }),
      })
      return
    }

    await route.continue()
  })
}

async function waitForRoute(page) {
  try {
    await page.getByRole('heading', { name: 'Social Content Queue' }).waitFor({ timeout: 20000 })
  } catch (error) {
    const debugPath = path.join(outputDir, `debug-${Date.now()}.png`)
    await page.screenshot({ path: debugPath, fullPage: true })
    const text = (await page.locator('body').innerText().catch(() => '')).slice(0, 800)
    console.error(JSON.stringify({ debugPath, url: page.url(), text }, null, 2))
    throw error
  }
}

async function assertNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  if (overflow) throw new Error('Social Content route has horizontal overflow in the QA viewport.')
}

async function addAnnotation(page, scenario) {
  await page.addStyleTag({
    content: scenario.annotation === 'side'
      ? `
        .admin-console-page { max-width: calc(100vw - 350px); }
        #qa-annotation {
          position: fixed;
          z-index: 2147483647;
          top: 20px;
          right: 20px;
          width: 310px;
          max-height: calc(100vh - 40px);
          overflow: auto;
          border: 1px solid rgba(245, 208, 96, 0.38);
          border-radius: 8px;
          background: rgba(7, 17, 31, 0.94);
          color: #e5e7eb;
          padding: 14px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
        }
      `
      : `
        #qa-annotation {
          position: fixed;
          z-index: 2147483647;
          right: 10px;
          bottom: 10px;
          left: 10px;
          max-height: 155px;
          overflow: auto;
          border: 1px solid rgba(245, 208, 96, 0.38);
          border-radius: 8px;
          background: rgba(7, 17, 31, 0.94);
          color: #e5e7eb;
          padding: 10px;
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.35);
        }
      `,
  })

  await page.evaluate(({ label, steps }) => {
    const aside = document.createElement('aside')
    aside.id = 'qa-annotation'
    aside.innerHTML = `
      <h2 style="margin:0 0 8px;color:#f5d060;font-size:15px;line-height:1.25">${label}</h2>
      <p style="margin:0 0 8px;color:#cbd5e1;font-size:12px;line-height:1.45"><strong style="color:white">Scenario:</strong> metric tiles filter the Social Content review list and stay synced with the dropdown.</p>
      <ul style="margin:0 0 8px;padding-left:16px;color:#cbd5e1;font-size:11px;line-height:1.45">${steps.map((step) => `<li>${step}</li>`).join('')}</ul>
      <p style="margin:0;color:#cbd5e1;font-size:11px;line-height:1.45"><strong style="color:white">Boundary:</strong> synthetic fixtures; no provider, publish, schedule, Gmail, Slack, SMS, or production-row action.</p>
    `
    document.body.appendChild(aside)
  }, { label: scenario.label, steps: scenario.steps })
}

async function convertToMp4(webmPath, mp4Path) {
  execFileSync('ffmpeg', [
    '-y',
    '-i',
    webmPath,
    '-movflags',
    '+faststart',
    '-pix_fmt',
    'yuv420p',
    '-vf',
    'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    mp4Path,
  ], { stdio: 'pipe' })
}

async function recordScenario(browser, scenario) {
  const externalRequests = []
  const suppressedExternalScripts = []
  const context = await browser.newContext({
    viewport: { width: scenario.width, height: scenario.height },
    recordVideo: {
      dir: videoDir,
      size: { width: scenario.width, height: scenario.height },
    },
  })
  await installFixtures(context, externalRequests, suppressedExternalScripts)
  const page = await context.newPage()
  await page.goto(`${baseUrl}/admin/social-content?workflow=review`)
  await waitForRoute(page)
  await addAnnotation(page, scenario)

  await page.getByRole('button', { name: 'Filter social content to drafts (2)' }).click()
  await page.getByText('draft QA content item 1').waitFor()
  await assertNoHorizontalOverflow(page)

  await page.getByRole('button', { name: 'Filter social content to approved (1)' }).click()
  await page.getByText('approved QA content item 1').waitFor()

  await page.getByRole('combobox', { name: 'Filter social content by status' }).selectOption('rejected')
  await page.getByText('rejected QA content item 1').waitFor()
  await assertNoHorizontalOverflow(page)

  await page.getByRole('button', { name: `Show all social content (${allItems.length} total)` }).click()
  await page.getByText('published QA content item 1').waitFor()
  await page.waitForTimeout(800)

  const video = page.video()
  await page.close()
  await context.close()
  const webmPath = await video.path()
  const mp4Path = path.join(outputDir, `${scenario.slug}.mp4`)
  await convertToMp4(webmPath, mp4Path)

  return {
    slug: scenario.slug,
    mp4Path,
    externalRequests,
    suppressedExternalScripts,
  }
}

async function main() {
  fs.mkdirSync(videoDir, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  try {
    results.push(await recordScenario(browser, {
      slug: 'social-content-metric-filters-desktop',
      label: 'Desktop metric-filter QA',
      width: 1500,
      height: 900,
      annotation: 'side',
      steps: [
        'Click Drafts tile and confirm the list narrows to draft rows.',
        'Click Approved tile and confirm the dropdown stays in sync.',
        'Select Rejected from the dropdown and confirm the Rejected tile reads active.',
        'Click Total and confirm status filtering clears.',
      ],
    }))
    results.push(await recordScenario(browser, {
      slug: 'social-content-metric-filters-mobile',
      label: 'Mobile metric-filter QA',
      width: 390,
      height: 844,
      annotation: 'mobile',
      steps: [
        'Use the same status tiles in a 390px mobile viewport.',
        'Confirm active tile styling remains visible.',
        'Check that the metric row and filtered list do not create horizontal overflow.',
      ],
    }))
  } finally {
    await browser.close()
  }

  const manifest = {
    baseUrl,
    route: '/admin/social-content?workflow=review',
    generatedAt: new Date().toISOString(),
    data: 'synthetic social-content QA fixtures',
    externalRequests: [...new Set(results.flatMap((result) => result.externalRequests))],
    suppressedExternalScripts: [...new Set(results.flatMap((result) => result.suppressedExternalScripts))],
    videos: results.map((result) => result.mp4Path),
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  console.log(JSON.stringify(manifest, null, 2))
  if (manifest.externalRequests.length > 0) {
    throw new Error('External requests were blocked during QA. See manifest for URLs.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
