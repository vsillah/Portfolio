const { chromium, expect } = require('@playwright/test')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')

const base = 'http://127.0.0.1:4033'
const out = path.resolve('docs/social-content/qa/practitioner-content-quality')
const rawVideo = path.resolve('test-results/practitioner-content-quality')
fs.mkdirSync(out, { recursive: true })
fs.mkdirSync(rawVideo, { recursive: true })

const postText = [
  'A nonprofit operations lead was reconciling the same intake in three spreadsheets every Friday.',
  'Volunteer coverage changed weekly, but the intake rules could not drift.',
  'We moved the rules into one reviewed queue and kept the final decision with the operations lead.',
  'The duplicate review step disappeared. The 30-day outcome check is still pending.',
  'Where does duplicate review still show up in your workflow?',
].join('\n\n')

const item = {
  id: 'practitioner-quality-qa', meeting_record_id: null, platform: 'linkedin', status: 'draft',
  post_text: postText, cta_text: null, cta_url: null, hashtags: ['AIProduct', 'ProductManagement', 'AmaduTownAdvisory'],
  image_url: null, image_prompt: null, framework_visual_type: 'architecture', voiceover_url: null, voiceover_text: null,
  video_url: null, topic_extracted: null, hormozi_framework: null, scheduled_for: null, published_at: null,
  platform_post_id: null, admin_notes: 'Synthetic privacy-safe QA fixture.', reviewed_by: null,
  target_platforms: ['linkedin'], video_generation_method: 'none', youtube_title: null, youtube_description: null,
  content_format: 'single_image', content_pillar: 'technology_as_equalizer', companion_post_text: null,
  carousel_slides: null, carousel_pdf_url: null, carousel_slide_urls: null, publishes: [],
  created_at: '2026-10-09T10:00:00.000Z', updated_at: '2026-10-09T10:05:00.000Z',
  rag_context: {
    source: 'social_content_calendar_authorization', source_type: 'social_content_calendar_item',
    calendar_item_id: 'synthetic-calendar', campaign_id: 'synthetic-campaign', campaign_name: 'Practitioner evidence QA',
    channel: 'linkedin', planned_angle: 'Show the operational constraint and decision.', publish_gate: 'draft_only',
    external_execution_enabled: false, approval_boundary: 'Synthetic internal review only. No provider, upload, scheduling, or publication action.',
    practitioner_content_quality: {
      version: 'practitioner_evidence_v1',
      evidence_packet: {
        status: 'approved',
        situation: 'A nonprofit operations lead reconciled the same intake in three spreadsheets every Friday.',
        operational_constraint: 'Volunteer coverage changed weekly while the intake rules needed to stay stable.',
        practitioner_only_detail: 'The lead checked one duplicate review queue before the Friday handoff.',
        decision_intervention: 'The team moved the rules into one reviewed queue and kept the final decision with the operations lead.',
        observable_result: { status: 'metric_pending', summary: 'The duplicate review step disappeared; the 30-day outcome check remains pending.', metric: '30-day outcome check pending' },
        approved_public_details: ['reconciling the same intake in three spreadsheets every Friday', 'volunteer coverage changed weekly but the intake rules could not drift', 'kept the final decision with the operations lead'],
        supported_claims: ['30-day outcome check is still pending'],
        disclosure_boundary: { classification: 'anonymized', summary: 'Role, workflow, and decision pattern may be shared. Organization and people remain unnamed.', prohibited_details: ['organization name', 'person name', 'contact details'] },
        source_provenance: [{ source_id: 'synthetic-source-1', source_type: 'approved_practitioner_summary', label: 'Synthetic operator summary', approved_for_public_use: true }],
        redaction_receipt: { receipt_id: 'redaction-synthetic-1', status: 'passed', reviewed_at: '2026-10-09T10:00:00.000Z', redactions: ['organization name', 'person name'], unresolved_identifier_types: [] },
      },
      deterministic_visual: {
        system_version: 'amadutown_deterministic_v1', template: 'constraint_decision_result', aspect_ratio: '1.91:1',
        eyebrow: 'Field note', headline: 'One queue. One decision owner.',
        evidence_lines: ['Three spreadsheets', 'Weekly volunteer changes', 'One reviewed queue'], result_label: '30-day metric pending',
        visual_rationale: 'Make the operating constraint and the decision change visible without exposing the organization.',
        candidate: { candidate_id: 'visual-candidate-synthetic-1', status: 'in_review', renderer: 'html_svg', artifact_url: null },
        art_direction_receipt: { provider: 'none', model: null, receipt_id: 'local-deterministic-synthetic-1', status: 'not_called' },
      },
    },
    content_calibration: {
      experiment_tags: {
        experiment_id: 'practitioner-depth-001', anecdote_depth: 'scene', specificity: 'high', evidence_type: 'metric_pending',
        hook_framework: 'operational_scene', channel: 'linkedin', visual_treatment: 'deterministic_constraint_decision_result',
        hypothesis: 'A concrete operating scene may correlate with more substantive comments than a theory-led post.', causal_claim_boundary: 'correlational_only', captured_engagement: null,
      },
    },
  },
}

const user = { id: 'synthetic-admin', email: 'qa@example.invalid', role: 'authenticated', aud: 'authenticated', user_metadata: {}, app_metadata: {} }

const blockedItem = structuredClone(item)
blockedItem.rag_context.practitioner_content_quality.evidence_packet.status = 'draft'
blockedItem.rag_context.practitioner_content_quality.evidence_packet.source_provenance = []
blockedItem.rag_context.practitioner_content_quality.evidence_packet.redaction_receipt = {
  receipt_id: null,
  status: 'pending',
  reviewed_at: null,
  redactions: [],
  unresolved_identifier_types: [],
}
blockedItem.rag_context.practitioner_content_quality.deterministic_visual.candidate.status = 'draft'
blockedItem.rag_context.content_calibration.experiment_tags.experiment_id = ''
blockedItem.rag_context.content_calibration.experiment_tags.hypothesis = ''

;(async () => {
  const browser = await chromium.launch()
  const results = []
  for (const width of [390, 768, 1440]) {
    let servedItem = blockedItem
    const external = []
    const mutations = []
    const pageErrors = []
    const context = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      recordVideo: { dir: rawVideo, size: { width, height: width === 390 ? 844 : 1000 } },
      serviceWorkers: 'block',
    })
    await context.addInitScript(({ user }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify({ access_token: 'synthetic-token', refresh_token: 'synthetic-refresh', expires_at: 4102444800, expires_in: 3600, token_type: 'bearer', user }))
    }, { user })
    await context.route('**/*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const method = request.method()
      const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
      if (url.hostname === 'va.vercel-scripts.com') return route.abort()
      if (url.origin === 'http://127.0.0.1:3999' && url.pathname === '/auth/v1/user') return json(user)
      if (url.origin !== base) { external.push(`${url.origin}${url.pathname}`); return route.abort() }
      if (method !== 'GET' && url.pathname.startsWith('/api/')) mutations.push(`${method} ${url.pathname}`)
      if (url.pathname === '/api/user/profile') return json({ profile: { id: user.id, email: user.email, role: 'admin' } })
      if (url.pathname === `/api/admin/social-content/${item.id}`) return json({ item: servedItem })
      if (url.pathname === '/api/admin/social-content/topic-backlog') return json({ items: [] })
      if (url.pathname === '/api/admin/social-content/calibration-library') return json({ references: [], counts: { total: 0 } })
      if (url.pathname.startsWith('/api/')) return json({ items: [], data: [], configs: [], references: [], count: 0 })
      return route.continue()
    })
    const page = await context.newPage()
    page.on('pageerror', (error) => pageErrors.push(error.message))
    const url = `${base}/admin/social-content/${item.id}?step=copy`
    await page.goto(url, { waitUntil: 'domcontentloaded' })

    const panel = page.getByRole('region', { name: 'Practitioner evidence and visual review' })
    await expect(panel).toBeVisible({ timeout: 90000 })
    await expect(panel.getByText('Blocked before Human QA')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Approve Copy' })).toBeDisabled()
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(out, `${width}-blocked-gate.png`), fullPage: true })

    servedItem = item
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(panel).toBeVisible({ timeout: 90000 })
    await expect(panel.getByText('Ready for Human QA')).toBeVisible()
    await expect(panel.getByText('One queue. One decision owner.')).toBeVisible()
    await expect(panel.getByText('Specificity: specific')).toBeVisible()
    await expect(panel.getByText('Correlation only')).toBeVisible()
    await expect(panel.getByLabel('Deterministic AmaduTown visual candidate')).toBeVisible()
    await panel.scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px horizontal overflow`)
    await page.screenshot({ path: path.join(out, `${width}-practitioner-review.png`), fullPage: true })
    assert.equal(mutations.length, 0, `${width}px QA made a mutation`)
    assert.equal(external.length, 0, `${width}px QA made an external request: ${external.join(', ')}`)
    assert.equal(pageErrors.length, 0, `${width}px QA emitted a page error`)

    results.push({ width, route: url, specificity: 'specific', gates_observed: ['blocked_before_human_qa', 'ready_for_human_qa'], provider_calls: 0, external_requests: 0, mutations: 0, page_errors: [] })
    const video = page.video()
    await context.close()
    const source = await video.path()
    const mp4 = path.join(out, `${width}-walkthrough.mp4`)
    execFileSync('ffmpeg', ['-y', '-i', source, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
    fs.unlinkSync(source)
  }
  await browser.close()
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2))
})().catch((error) => {
  console.error(error)
  process.exit(1)
})
