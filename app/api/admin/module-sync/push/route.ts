import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getModuleEntryForDiff } from '@/lib/module-sync-db'
import { parseGitHubRepoUrl } from '@/lib/module-sync-diff'

export const dynamic = 'force-dynamic'

const GITHUB_API = 'https://api.github.com'
const WORKFLOW_ID = 'sync-module-to-spinoff.yml'

/**
 * POST /api/admin/module-sync/push
 * Trigger the GitHub Action that runs git subtree push to the spin-off repo.
 * Body: { moduleId: string }
 * Admin only. Requires GITHUB_TOKEN (repo + workflow) and GITHUB_REPO (portfolio owner/repo).
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const githubToken = process.env.GITHUB_TOKEN
  const portfolioRepo = process.env.GITHUB_REPO?.trim()

  if (!githubToken) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN is not configured. Add it to trigger the sync workflow.' },
      { status: 503 }
    )
  }
  if (!portfolioRepo || !/^[\w.-]+\/[\w.-]+$/.test(portfolioRepo)) {
    return NextResponse.json(
      { error: 'GITHUB_REPO is not set or invalid. Use owner/repo (e.g. vsillah/Portfolio).' },
      { status: 503 }
    )
  }

  let body: { moduleId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const moduleId = body.moduleId?.trim()
  if (!moduleId) {
    return NextResponse.json({ error: 'Missing moduleId in body' }, { status: 400 })
  }

  const entry = await getModuleEntryForDiff(moduleId)
  if (!entry) {
    return NextResponse.json({ error: `Unknown module: ${moduleId}` }, { status: 404 })
  }
  const repoUrl = entry.spunOffRepoUrl?.trim() || entry.suggestedSpunOffRepoUrl?.trim()
  if (!repoUrl) {
    return NextResponse.json(
      { error: 'No spun-off repo URL configured for this module. Set GITHUB_REPO and save a URL (or use the prepopulated one).' },
      { status: 400 }
    )
  }

  const parsed = parseGitHubRepoUrl(repoUrl)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Spun-off repo URL is not a valid GitHub repo URL.' },
      { status: 400 }
    )
  }

  const [owner, repo] = portfolioRepo.split('/')
  const targetRepo = `${parsed.owner}/${parsed.repo}`

  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_ID}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          prefix: entry.portfolioPath,
          target_repo: targetRepo,
          target_branch: 'main',
        },
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    let message = `GitHub API returned ${res.status}`
    try {
      const data = JSON.parse(text) as { message?: string }
      if (data.message) message = data.message
    } catch {
      if (text) message = text.slice(0, 200)
    }
    return NextResponse.json(
      { error: `Failed to trigger workflow: ${message}` },
      { status: res.status >= 500 ? 502 : 400 }
    )
  }

  const actionsUrl = `https://github.com/${owner}/${repo}/actions`
  return NextResponse.json({
    ok: true,
    message: 'Sync workflow triggered. It will run in the portfolio repo.',
    workflowUrl: actionsUrl,
  })
}
