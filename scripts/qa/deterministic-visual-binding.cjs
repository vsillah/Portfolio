const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = (process.env.QA_BASE_URL || 'http://127.0.0.1:4033').replace(/\/$/, '')
const baseOrigin = new URL(base).origin
const sourceCommit = process.env.QA_SOURCE_COMMIT?.trim() || null
const trustedOidcToken = process.env.VERCEL_OIDC_TOKEN?.trim() || null
const contentId = 'deterministic-visual-binding-qa'
const outputDir = path.resolve('docs/social-content/qa/deterministic-visual-binding')
const tempDir = path.resolve('test-results/deterministic-visual-binding')
const publicDir = path.resolve('public')
fs.mkdirSync(outputDir, { recursive: true })
fs.mkdirSync(tempDir, { recursive: true })

const evidenceStills = new Set([
  '390-system-light-admin-compact-radar.png',
  '390-dark-admin-compact-radar.png',
  '1440-system-light-agents-full-radar.png',
  '1440-dark-agents-full-radar.png',
  '390-system-light-recipe-effective-inputs.png',
  '390-system-light-recipe-unsupported.png',
  '768-system-light-recipe-dirty.png',
  '1440-system-light-recipe-current-asset.png',
  '1440-dark-recipe-current-asset.png',
  '390-system-light-recipe-decision.png',
  '390-dark-recipe-decision.png',
])

const user = {
  id: 'synthetic-admin',
  email: 'qa@example.invalid',
  role: 'authenticated',
  aud: 'authenticated',
  user_metadata: {},
  app_metadata: {},
}
const session = {
  access_token: 'synthetic-preview-token',
  refresh_token: 'synthetic-preview-refresh',
  expires_at: 4102444800,
  expires_in: 3600,
  token_type: 'bearer',
  user,
}

const radarSnapshot = {
  ok: true,
  generated_at: '2026-10-11T14:00:00.000Z',
  refresh_interval_seconds: 15,
  summary: {
    active: 1,
    idle: 0,
    queued: 1,
    waiting_for_approval: 0,
    blocked: 1,
    stale: 0,
    failed: 0,
  },
  agents: [
    {
      key: 'chief-of-staff',
      name: 'Shaka (Zulu) - Chief of Staff',
      pod_key: 'chief_of_staff',
      pod_name: 'Chief of Staff',
      runtime: 'mixed',
      organization_status: 'partial',
      live_state: 'active',
      idle_reason: null,
      current_work_item: {
        id: 'work-active',
        title: 'Review governed Agent Ops work',
        status: 'in_progress',
        priority: 'high',
        href: '/admin/agents/swarm-board?work_item=work-active',
      },
      active_run: {
        id: 'run-active',
        title: 'Captain review',
        status: 'running',
        href: '/admin/agents/runs/run-active',
      },
      current_step: 'Checking evidence before the human gate',
      latest_event: null,
      linked_goal: {
        id: 'AGENT-OPS-THEME-QA-001',
        title: 'Agent Ops theme repair',
        href: '/admin/agents/standup?goal=AGENT-OPS-THEME-QA-001',
        current_gate: 'captain_qa',
        gate_status: 'captain_pending',
        challenger_status: 'passed',
        pass_to_human: false,
      },
      backlog_lane: {
        key: 'in_progress',
        label: 'In Progress',
        href: '/admin/agents/swarm-board?work_item=work-active',
      },
      age_seconds: 60,
      trace_href: '/admin/agents/runs/run-active',
      steer_actions: [
        { kind: 'open_trace', label: 'Open trace', href: '/admin/agents/runs/run-active' },
        { kind: 'open_kanban', label: 'Open Kanban', href: '/admin/agents/swarm-board?work_item=work-active' },
      ],
    },
    {
      key: 'automation-systems',
      name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      pod_key: 'product_automation',
      pod_name: 'Product & Automation Pod',
      runtime: 'n8n',
      organization_status: 'partial',
      live_state: 'blocked',
      idle_reason: null,
      current_work_item: {
        id: 'work-blocked',
        title: 'Resolve a synthetic workflow blocker',
        status: 'blocked',
        priority: 'urgent',
        href: '/admin/agents/swarm-board?work_item=work-blocked',
      },
      active_run: null,
      current_step: 'Needs an operator decision',
      latest_event: null,
      linked_goal: null,
      backlog_lane: {
        key: 'blocked',
        label: 'Blocked',
        href: '/admin/agents/swarm-board?work_item=work-blocked',
      },
      age_seconds: 600,
      trace_href: null,
      steer_actions: [
        { kind: 'open_kanban', label: 'Open Kanban', href: '/admin/agents/swarm-board?work_item=work-blocked' },
      ],
    },
    {
      key: 'voice-content-architect',
      name: 'Nana Yaa - Voice and Content Architect',
      pod_key: 'content_production',
      pod_name: 'Content Production Pod',
      runtime: 'portfolio',
      organization_status: 'active',
      live_state: 'queued',
      idle_reason: null,
      current_work_item: {
        id: 'content-work-1',
        title: 'Review the deterministic visual recipe',
        status: 'queued',
        priority: 'medium',
        href: '/admin/agents/swarm-board?work_item=content-work-1',
      },
      active_run: null,
      current_step: 'Queued for visual review',
      latest_event: null,
      linked_goal: null,
      backlog_lane: {
        key: 'queued',
        label: 'Queued',
        href: '/admin/agents/swarm-board?work_item=content-work-1',
      },
      age_seconds: 180,
      trace_href: null,
      steer_actions: [],
    },
  ],
  attention: [
    {
      id: 'automation-systems:blocked:work-blocked',
      severity: 'warning',
      title: 'Resolve synthetic workflow blocker',
      detail: 'An operator decision is required before this fixture can move.',
      agent_key: 'automation-systems',
      agent_name: 'Yaa Asantewaa (Ashanti) - Automation Systems',
      state: 'blocked',
      href: '/admin/agents/swarm-board?work_item=work-blocked',
      age_seconds: 600,
    },
  ],
}

const missionSnapshot = {
  generated_at: '2026-10-11T14:00:00.000Z',
  status_strip: {
    active: 2,
    queued: 1,
    running: 1,
    waiting_for_approval: 1,
    failed: 0,
    stale: 0,
    cost_today: 0,
    pending_approvals: 1,
  },
  roster: [
    {
      key: 'command',
      name: 'Command',
      purpose: 'Coordinate governed agent work.',
      agents: [
        {
          key: 'chief-of-staff',
          name: 'Shaka',
          pod: 'Command',
          status: 'active',
          runtime: 'portfolio',
          responsibility: 'Coordinate agent operations.',
          active_workflow_count: 1,
          latest_run: null,
        },
        {
          key: 'automation-systems',
          name: 'Yaa Asantewaa',
          pod: 'Automation',
          status: 'partial',
          runtime: 'n8n',
          responsibility: 'Keep automation lanes reviewable.',
          active_workflow_count: 1,
          latest_run: null,
        },
      ],
    },
  ],
  attention_queue: [],
  active_runs: [],
  latest_events: [],
  latest_standup: null,
  daily_brief: {
    headline: 'Captain review is active',
    synthesis: 'Theme and deterministic visual evidence are being checked with synthetic data.',
    generated_from: 'current_state',
    run_id: null,
    updated_at: '2026-10-11T14:00:00.000Z',
    signals: ['1 review gate'],
    next_actions: ['Review the decision queue.'],
  },
  cost_summary: {
    window_hours: 24,
    total: 0,
    event_count: 0,
    linked_event_count: 0,
    unlinked_event_count: 0,
    by_runtime: [],
    by_agent: [],
    by_workflow: [],
    by_client_project: [],
    by_artifact_type: [],
  },
  quality_summary: {
    window_hours: 24,
    generated_at: '2026-10-11T14:00:00.000Z',
    rubric_count: 0,
    evaluation_count: 0,
    average_score: null,
    pass_rate: null,
    by_agent: [],
    needs_coaching: [],
    rubric_trends: [],
  },
  operating_signals: [],
  knowledge_governance: null,
  agent_inbox: [],
  engagement_queue: [],
  dead_letter_queue: [],
  dependency_blockers: [],
  high_signal_ai_insights: [],
}

const socialRouteFor = (state) => `${base}/admin/social-content/${contentId}?step=visuals&qa=deterministic-visual-binding&qa_state=${state}`

async function reveal(locator, block = 'center') {
  await locator.evaluate((element, targetBlock) => {
    element.scrollIntoView({ block: targetBlock, inline: 'nearest', behavior: 'instant' })
  }, block)
}

async function pauseAtWorkflowStep(page, step) {
  await reveal(page.locator(`[data-visual-workflow-step="${step}"]`))
  await page.waitForTimeout(700)
}

async function captureEvidenceStill(page, evidencePrefix, suffix) {
  const filename = `${evidencePrefix}-${suffix}.png`
  if (!evidenceStills.has(filename)) return
  await page.screenshot({ path: path.join(outputDir, filename) })
}

async function assertResolvedTheme(page, theme, evidencePrefix) {
  await page.waitForFunction(
    ({ resolved }) => document.documentElement.classList.contains('dark') === (resolved === 'dark'),
    { resolved: theme.resolved },
  )
  const themeState = await page.evaluate(() => ({
    preference: localStorage.getItem('theme'),
    darkClass: document.documentElement.classList.contains('dark'),
  }))
  assert.equal(themeState.preference, theme.preference, `${evidencePrefix} persisted theme preference`)
  assert.equal(themeState.darkClass, theme.resolved === 'dark', `${evidencePrefix} resolved theme class`)
}

async function auditAgentOpsTheme(page, resolved, includeSideRail) {
  return page.evaluate(({ resolvedTheme, includeRail }) => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) || []
      return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 }
    }
    const composite = (front, back) => {
      const alpha = front.a + back.a * (1 - front.a)
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
        a: alpha,
      }
    }
    const luminance = ({ r, g, b }) => {
      const values = [r, g, b].map((channel) => {
        const value = channel / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    }
    const effectiveBackground = (element) => {
      const ancestors = []
      let current = element
      while (current) {
        ancestors.unshift(current)
        current = current.parentElement
      }
      let color = { r: 255, g: 255, b: 255, a: 1 }
      for (const ancestor of ancestors) color = composite(parse(getComputedStyle(ancestor).backgroundColor), color)
      return color
    }
    const selectors = {
      radar: '[data-agent-ops-surface="radar-root"]',
      summary: '[data-agent-ops-surface="summary-metric"]',
      lifecycle: '[data-agent-ops-surface="lifecycle-map"]',
      attention: '[data-agent-ops-surface="attention-list"]',
      selected: '[data-agent-ops-surface="selected-agent"]',
      ...(includeRail ? { side_rail: '[data-agent-ops-surface="operations-side-rail"]' } : {}),
    }
    const surfaces = Object.fromEntries(Object.entries(selectors).map(([name, selector]) => {
      const element = document.querySelector(selector)
      return [name, element ? Number(luminance(effectiveBackground(element)).toFixed(3)) : null]
    }))
    return {
      resolved_theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      expected_theme: resolvedTheme,
      semantic_root: document.querySelector('[data-agent-ops-surface="radar-root"]')?.getAttribute('data-agent-ops-contrast'),
      surfaces,
      horizontal_overflow: document.documentElement.scrollWidth > innerWidth,
    }
  }, { resolvedTheme: resolved, includeRail: includeSideRail })
}

function assertAgentOpsAudit(audit, resolved, evidencePrefix) {
  assert.equal(audit.resolved_theme, resolved, `${evidencePrefix} Agent Ops resolved theme`)
  assert.equal(audit.semantic_root, 'semantic', `${evidencePrefix} semantic contrast root`)
  assert.equal(audit.horizontal_overflow, false, `${evidencePrefix} Agent Ops horizontal overflow`)
  for (const [name, value] of Object.entries(audit.surfaces)) {
    assert.notEqual(value, null, `${evidencePrefix} missing Agent Ops surface ${name}`)
    if (resolved === 'light') assert.ok(value > 0.52, `${evidencePrefix} ${name} remained dark in light mode (${value})`)
    else assert.ok(value < 0.52, `${evidencePrefix} ${name} remained light in dark mode (${value})`)
  }
}

async function auditSocialVisual(page, resolved) {
  return page.evaluate(({ resolvedTheme }) => {
    const parse = (value) => {
      const parts = value.match(/[\d.]+/g)?.map(Number) || []
      return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 }
    }
    const composite = (front, back) => {
      const alpha = front.a + back.a * (1 - front.a)
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
        a: alpha,
      }
    }
    const luminance = ({ r, g, b }) => {
      const values = [r, g, b].map((channel) => {
        const value = channel / 255
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2]
    }
    const effectiveBackground = (element) => {
      const ancestors = []
      let current = element
      while (current) {
        ancestors.unshift(current)
        current = current.parentElement
      }
      let color = { r: 255, g: 255, b: 255, a: 1 }
      for (const ancestor of ancestors) color = composite(parse(getComputedStyle(ancestor).backgroundColor), color)
      return color
    }
    const contrast = (foreground, background) => {
      const lighter = Math.max(luminance(foreground), luminance(background))
      const darker = Math.min(luminance(foreground), luminance(background))
      return (lighter + 0.05) / (darker + 0.05)
    }
    const contrastChecks = Array.from(document.querySelectorAll('[data-contrast-audit]')).map((element) => {
      const styles = getComputedStyle(element)
      const background = effectiveBackground(element)
      const foreground = composite(parse(styles.color), background)
      const ratio = contrast(foreground, background)
      const fontSize = Number.parseFloat(styles.fontSize)
      const fontWeight = Number.parseInt(styles.fontWeight, 10) || 400
      const minimum = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5
      return { name: element.getAttribute('data-contrast-audit'), ratio: Number(ratio.toFixed(2)), minimum }
    })
    const laneElement = document.querySelector('[data-social-detail-content]')
    const lane = laneElement.getBoundingClientRect()
    const laneStyles = getComputedStyle(laneElement)
    const horizontalPadding = Number.parseFloat(laneStyles.paddingLeft) + Number.parseFloat(laneStyles.paddingRight)
    return {
      resolved_theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
      expected_theme: resolvedTheme,
      content_lane: {
        left: Number(lane.left.toFixed(1)),
        right: Number(lane.right.toFixed(1)),
        width: Number(lane.width.toFixed(1)),
        usable_width: Number((lane.width - horizontalPadding).toFixed(1)),
        viewport_width: innerWidth,
      },
      contrast_checks: contrastChecks,
      horizontal_overflow: document.documentElement.scrollWidth > innerWidth,
    }
  }, { resolvedTheme: resolved })
}

function dashboardResponse(pathname) {
  if (pathname === '/api/admin/outreach/dashboard') return { funnel: { total: 0, contacted: 0, replied: 0, booked: 0 }, funnelByTemperature: {}, queueStats: { total: 0, draft: 0, sent: 0, replied: 0 }, recentActivity: [] }
  if (pathname === '/api/admin/value-evidence/dashboard') return { overview: { totalEvidence: 0 } }
  if (pathname === '/api/admin/value-evidence/reports') return { reports: [] }
  if (pathname === '/api/admin/sales') return { stats: { total_audits: 0, pending_follow_up: 0, converted: 0, high_urgency: 0 } }
  if (pathname === '/api/admin/campaigns') return { data: [] }
  if (pathname === '/api/admin/client-projects') return { projects: [] }
  if (pathname === '/api/meeting-action-tasks') return { tasks: [] }
  if (pathname === '/api/admin/guarantees') return { data: [] }
  if (pathname === '/api/admin/chat-eval/stats') return { overview: { total_sessions: 0, evaluated_sessions: 0, success_rate: 0 } }
  if (pathname === '/api/admin/chat-eval') return { sessions: [] }
  if (pathname === '/api/analytics/stats') return { totalSessions: 0, totalPageViews: 0, totalClicks: 0, totalFormSubmits: 0, eventsByType: {} }
  if (pathname === '/api/admin/subscriptions/status') return { buckets: {}, summary: { headline: 'No subscription signals' } }
  if (pathname === '/api/admin/configuration/counts') return { users: 0, prompts: 0, contentItems: 0 }
  return null
}

;(async () => {
  const browser = await chromium.launch()
  const results = []
  const themes = [
    { name: 'system-light', preference: 'system', colorScheme: 'light', resolved: 'light' },
    { name: 'dark', preference: 'dark', colorScheme: 'dark', resolved: 'dark' },
  ]

  for (const theme of themes) {
    for (const width of [390, 768, 1440]) {
      const height = width === 390 ? 844 : 1000
      const evidencePrefix = `${width}-${theme.name}`
      const external = []
      const unexpectedMutations = []
      const pageErrors = []
      const fixtureResponses = []
      const recipeSaveBodies = []
      const renderBodies = []
      let recipeSaveRequests = 0
      let renderRequests = 0
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme.colorScheme,
        recordVideo: { dir: tempDir, size: { width, height } },
        serviceWorkers: 'block',
        ...(trustedOidcToken
          ? { extraHTTPHeaders: { 'x-vercel-trusted-oidc-idp-token': trustedOidcToken } }
          : {}),
      })
      await context.addInitScript(({ browserSession, themePreference }) => {
        localStorage.setItem('theme', themePreference)
        const originalGetItem = Storage.prototype.getItem
        Storage.prototype.getItem = function getItem(key) {
          if (/^sb-.*-auth-token$/.test(key)) return JSON.stringify(browserSession)
          if (key === 'theme') return themePreference
          return originalGetItem.call(this, key)
        }
      }, { browserSession: session, themePreference: theme.preference })

      await context.route('**/*', async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const method = request.method()
        const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })

        if (url.hostname === 'va.vercel-scripts.com' || url.hostname === 'vercel.live') return route.abort()
        if (url.origin === 'https://amadutown.com' && url.pathname.startsWith('/agent-avatars/')) {
          const localAssetPath = path.resolve(publicDir, `.${url.pathname}`)
          assert.ok(localAssetPath.startsWith(`${publicDir}${path.sep}`), `${evidencePrefix} avatar path escaped public directory`)
          assert.ok(fs.existsSync(localAssetPath), `${evidencePrefix} missing local avatar fixture: ${url.pathname}`)
          return route.fulfill({ path: localAssetPath })
        }
        if (url.pathname === '/auth/v1/user') return json(user)
        if (url.pathname === '/rest/v1/user_profiles') return json([{ id: user.id, email: user.email, role: 'admin' }])
        if (url.origin !== baseOrigin) {
          external.push(`${method} ${url.origin}${url.pathname}`)
          return route.abort()
        }
        if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
        if (url.pathname === '/api/admin/agents/activity-radar') return json(radarSnapshot)
        if (url.pathname === '/api/admin/agents/mission-control') return json(missionSnapshot)
        if (url.pathname === '/api/admin/agents/risk-compliance/monitor') return json({ review: null })
        if (url.pathname === '/api/admin/agents/runs') return json({ runs: [] })
        if (url.pathname === '/api/admin/agents/swarm-board') return json({ ok: true, organization: { summary: { goals: [] } } })
        if (url.pathname === '/api/admin/agents/automation-goals') return json({ goals: [] })

        const dashboard = dashboardResponse(url.pathname)
        if (dashboard) return json(dashboard)

        if (url.pathname === `/api/admin/social-content/${contentId}/render-deterministic-visual`) {
          if (method !== 'POST') unexpectedMutations.push(`${method} ${url.pathname}`)
          else {
            renderRequests += 1
            renderBodies.push(request.postDataJSON())
          }
          return route.continue()
        }
        if (url.pathname === `/api/admin/social-content/${contentId}`) {
          if (method === 'PUT') {
            recipeSaveRequests += 1
            recipeSaveBodies.push(request.postDataJSON())
          } else if (method !== 'GET') unexpectedMutations.push(`${method} ${url.pathname}`)
          return route.continue()
        }
        if (url.pathname.startsWith('/api/')) {
          if (method !== 'GET') unexpectedMutations.push(`${method} ${url.pathname}`)
          return json({ items: [], data: [], configs: [], references: [], count: 0 })
        }
        return route.continue()
      })

      const page = await context.newPage()
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('response', async (response) => {
        const url = new URL(response.url())
        if (url.origin !== baseOrigin || !url.pathname.startsWith(`/api/admin/social-content/${contentId}`)) return
        const body = await response.json().catch(() => null)
        if (body?.fixture === true) fixtureResponses.push({ path: url.pathname, state: body.fixture_state || body.render?.state || null })
      })

      await page.goto(`${base}/admin`, { waitUntil: 'domcontentloaded' })
      const compactRadar = page.locator('[data-agent-ops-surface="radar-root"]')
      await expect(compactRadar).toBeVisible({ timeout: 90000 })
      await expect(page.getByText('Live agent work map')).toBeVisible()
      await assertResolvedTheme(page, theme, `${evidencePrefix} compact radar`)
      const compactShaka = page.locator('button[aria-label^="Open "][aria-label$=" lifecycle detail"]').first()
      await reveal(compactRadar)
      await compactShaka.hover()
      await expect(page.locator('[data-agent-ops-surface="lifecycle-tooltip"]')).toBeVisible()
      await page.waitForTimeout(900)
      await compactShaka.click()
      await expect(page.getByLabel('Selected agent detail')).toBeVisible()
      await captureEvidenceStill(page, evidencePrefix, 'admin-compact-radar')
      const compactRadarAudit = await auditAgentOpsTheme(page, theme.resolved, false)
      assertAgentOpsAudit(compactRadarAudit, theme.resolved, `${evidencePrefix} compact radar`)

      await page.goto(`${base}/admin/agents`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByRole('heading', { name: 'Mission Control' })).toBeVisible({ timeout: 90000 })
      const fullRadar = page.locator('[data-agent-ops-surface="radar-root"]')
      await expect(fullRadar).toBeVisible()
      await expect(page.locator('[data-agent-ops-surface="operations-side-rail"]')).toBeVisible()
      await assertResolvedTheme(page, theme, `${evidencePrefix} full radar`)
      const fullShaka = page.locator('button[aria-label^="Open "][aria-label$=" lifecycle detail"]').first()
      await reveal(fullRadar)
      await fullShaka.hover()
      await expect(page.locator('[data-agent-ops-surface="lifecycle-tooltip"]')).toBeVisible()
      await page.waitForTimeout(900)
      await fullShaka.click()
      await expect(page.getByLabel('Selected agent detail')).toBeVisible()
      await captureEvidenceStill(page, evidencePrefix, 'agents-full-radar')
      const sideRail = page.locator('[data-agent-ops-surface="operations-side-rail"]')
      await reveal(sideRail)
      await page.waitForTimeout(900)
      await captureEvidenceStill(page, evidencePrefix, 'agents-side-rail')
      const fullRadarAudit = await auditAgentOpsTheme(page, theme.resolved, true)
      assertAgentOpsAudit(fullRadarAudit, theme.resolved, `${evidencePrefix} full radar`)

      await page.goto(socialRouteFor('ready'), { waitUntil: 'domcontentloaded' })
      await expect(page.getByText('Synthetic production-equivalent fixture')).toBeVisible({ timeout: 90000 })
      await assertResolvedTheme(page, theme, `${evidencePrefix} social recipe`)

      const renderStatus = page.getByLabel('Deterministic visual render status')
      const effectiveInputs = page.getByLabel('Effective deterministic visual inputs')
      const renderButton = page.getByRole('button', { name: 'Render deterministic visual' })
      const saveRecipeButton = page.getByRole('button', { name: /Save and rebuild recipe|Recipe validated/ })
      await expect(renderStatus.getByText('Ready to render')).toBeVisible()
      await expect(renderStatus.getByText('Provider none')).toBeVisible()
      assert.equal(await effectiveInputs.evaluate((element) => element.open), false, `${evidencePrefix} effective inputs start collapsed`)
      await effectiveInputs.locator('summary').click()
      await expect(effectiveInputs.getByText('Constraint → decision → result', { exact: false })).toBeVisible()
      await expect(effectiveInputs.getByText(/constraint_decision_result/)).toBeVisible()
      await expect(effectiveInputs.getByText('architecture', { exact: true }).first()).toBeVisible()
      await expect(effectiveInputs.getByText('Provenance', { exact: true })).toBeVisible()
      await reveal(effectiveInputs)
      await page.waitForTimeout(900)
      await captureEvidenceStill(page, evidencePrefix, 'recipe-effective-inputs')
      await effectiveInputs.locator('summary').click()
      assert.equal(await effectiveInputs.evaluate((element) => element.open), false, `${evidencePrefix} effective inputs collapse after inspection`)
      await expect(page.getByRole('textbox', { name: /image prompt/i })).toHaveCount(0)
      await expect(page.getByLabel('Why this image will look this way')).toBeVisible()
      const providerDirection = page.getByText('Provider art direction · stored, collapsed, and excluded from this render', { exact: true }).locator('..')
      await expect(providerDirection).toContainText('future provider-media or asset-packet handoff')
      await expect(providerDirection).toContainText('deterministic render button never reads it')
      assert.equal(await providerDirection.evaluate((element) => element.open), false, `${evidencePrefix} provider art direction stays collapsed`)
      const workflowOrder = await page.locator('[data-visual-workflow-step]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-visual-workflow-step')))
      assert.deepEqual(workflowOrder, ['recipe', 'validation', 'render', 'preview', 'decision'], `${evidencePrefix} workflow order`)
      await expect(page.getByText(/Gemini, HeyGen, n8n media, and other media providers stay off/i)).toBeVisible()
      await expect(renderButton).toBeEnabled()

      await pauseAtWorkflowStep(page, 'recipe')
      await page.locator('#deterministic-visual-template').selectOption('practitioner_signal_card')
      const unsupportedRecipe = page.getByText(/does not have an enabled deterministic renderer/i)
      await expect(unsupportedRecipe).toBeVisible()
      await expect(page.locator('#deterministic-visual-type')).toBeDisabled()
      await expect(saveRecipeButton).toBeDisabled()
      await expect(renderButton).toBeDisabled()
      await reveal(unsupportedRecipe)
      await page.waitForTimeout(900)
      await captureEvidenceStill(page, evidencePrefix, 'recipe-unsupported')

      await page.locator('#deterministic-visual-template').selectOption('constraint_decision_result')
      await expect(page.locator('#deterministic-visual-type')).toHaveValue('architecture')
      await page.locator('#deterministic-visual-aspect').selectOption('4:5')
      await expect(renderStatus.getByText('Save and rebuild the visual recipe before rendering.')).toBeVisible()
      await expect(renderButton).toBeDisabled()
      await expect(page.getByText(/prior asset is not current for the visible selection/i)).toBeVisible()
      await pauseAtWorkflowStep(page, 'validation')
      await captureEvidenceStill(page, evidencePrefix, 'recipe-dirty')

      await page.getByRole('button', { name: 'Save and rebuild recipe' }).click()
      await expect(page.getByRole('button', { name: 'Recipe validated' })).toBeDisabled()
      await expect(renderStatus.getByText('Ready to render')).toBeVisible()
      await expect(effectiveInputs).toContainText('4:5')
      await expect(renderButton).toBeEnabled()
      await pauseAtWorkflowStep(page, 'render')
      await captureEvidenceStill(page, evidencePrefix, 'recipe-validated')

      await renderButton.click()
      await expect(page.getByRole('button', { name: 'Review asset current' })).toBeDisabled()
      await expect(renderStatus.getByText('Asset current')).toBeVisible()
      await expect(renderStatus.getByText(/provider none · external call false/i)).toBeVisible()
      const reviewAsset = page.getByAltText('Deterministic AmaduTown review asset').first()
      await expect(reviewAsset).toBeVisible()
      await reveal(reviewAsset)
      await page.waitForTimeout(1100)
      await captureEvidenceStill(page, evidencePrefix, 'recipe-current-asset')
      await pauseAtWorkflowStep(page, 'decision')
      await expect(page.getByRole('button', { name: 'Approve Visuals' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Reject Visuals' })).toBeVisible()
      await page.waitForTimeout(900)
      await captureEvidenceStill(page, evidencePrefix, 'recipe-decision')

      const socialAudit = await auditSocialVisual(page, theme.resolved)
      assert.equal(socialAudit.resolved_theme, theme.resolved, `${evidencePrefix} social resolved theme`)
      assert.ok(socialAudit.content_lane.width > 0, `${evidencePrefix} content lane width`)
      assert.ok(socialAudit.content_lane.usable_width > 0, `${evidencePrefix} usable content lane width`)
      assert.ok(socialAudit.content_lane.left >= 0 && socialAudit.content_lane.right <= width + 1, `${evidencePrefix} content lane bounds`)
      assert.equal(socialAudit.horizontal_overflow, false, `${evidencePrefix} social horizontal overflow`)
      assert.ok(socialAudit.contrast_checks.length >= 2, `${evidencePrefix} contrast sample coverage`)
      for (const check of socialAudit.contrast_checks) assert.ok(check.ratio >= check.minimum, `${evidencePrefix} ${check.name} contrast ${check.ratio} < ${check.minimum}`)

      assert.equal(recipeSaveRequests, 1, `${evidencePrefix} should issue one synthetic recipe save`)
      assert.equal(renderRequests, 1, `${evidencePrefix} should issue one synthetic render`)
      assert.deepEqual(recipeSaveBodies[0]?.visual_recipe, {
        template: 'constraint_decision_result',
        visual_type: 'architecture',
        aspect_ratio: '4:5',
      }, `${evidencePrefix} persisted exact recipe`)
      assert.equal('image_prompt' in recipeSaveBodies[0], false, `${evidencePrefix} recipe save excluded image prompt`)
      assert.equal('image_prompt' in renderBodies[0], false, `${evidencePrefix} render request excluded image prompt`)
      assert.equal(renderBodies[0]?.qa_visual_recipe?.aspect_ratio, '4:5', `${evidencePrefix} render used persisted aspect`)
      assert.match(renderBodies[0]?.expected_recipe_version || '', /^[a-f0-9]{64}$/, `${evidencePrefix} render fenced exact recipe version`)
      assert.deepEqual(unexpectedMutations, [], `${evidencePrefix} emitted an unexpected mutation`)
      assert.deepEqual(external, [], `${evidencePrefix} emitted an external request`)
      assert.deepEqual(pageErrors, [], `${evidencePrefix} emitted a page error`)

      const video = page.video()
      await context.close()
      const rawVideo = await video.path()
      const mp4 = path.join(outputDir, `${evidencePrefix}-walkthrough.mp4`)
      execFileSync('ffmpeg', [
        '-y', '-i', rawVideo,
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        mp4,
      ], { stdio: 'ignore' })
      fs.unlinkSync(rawVideo)
      const duration = Number(execFileSync('ffprobe', [
        '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4,
      ], { encoding: 'utf8' }).trim())
      assert.ok(Number.isFinite(duration) && duration > 1, `${evidencePrefix} MP4 is not playable`)

      results.push({
        base_url: base,
        source_commit: sourceCommit,
        width,
        height,
        theme: theme.name,
        persisted_theme: theme.preference,
        resolved_theme: theme.resolved,
        routes: [`${base}/admin`, `${base}/admin/agents`, socialRouteFor('ready')],
        agent_ops: {
          compact_dashboard: compactRadarAudit,
          full_mission_control: fullRadarAudit,
        },
        fixture_responses: fixtureResponses,
        workflow_order: workflowOrder,
        deterministic_image_prompt_controls: 0,
        recipe: recipeSaveBodies[0]?.visual_recipe,
        expected_recipe_version: renderBodies[0]?.expected_recipe_version,
        content_lane: socialAudit.content_lane,
        contrast_checks: socialAudit.contrast_checks,
        provider: 'none',
        provider_calls: 0,
        shared_database_writes: 0,
        shared_storage_writes: 0,
        platform_drafts: 0,
        uploads: 0,
        scheduled_posts: 0,
        publications: 0,
        external_sends: 0,
        synthetic_recipe_save_requests: recipeSaveRequests,
        synthetic_render_requests: renderRequests,
        horizontal_overflow: false,
        page_errors: [],
        video: {
          path: path.relative(process.cwd(), mp4),
          duration_seconds: Number(duration.toFixed(2)),
          playable: true,
        },
      })
    }
  }

  await browser.close()
  fs.writeFileSync(path.join(outputDir, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  console.log(JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
