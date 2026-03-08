import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import {
  parseGitHubRepoEnv,
  isPortfolioPathRegistered,
} from '@/lib/module-sync-db'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const GITHUB_API = 'https://api.github.com'

/** Sanitize repo name: GitHub allows [a-zA-Z0-9_.-]. Use last path segment, replace invalid with -. */
function deriveRepoName(portfolioPath: string): string {
  const segment = portfolioPath.trim().replace(/\/+$/, '').split('/').pop() ?? 'repo'
  return segment.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'repo'
}

/**
 * POST /api/admin/module-sync/create-repo
 * Create a GitHub repo and add the module to module_sync_custom.
 * Body: { portfolioPath: string, repoName?: string, name?: string, description?: string }
 * Admin only. Requires GITHUB_TOKEN (repo/create) and GITHUB_REPO.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const githubToken = process.env.GITHUB_TOKEN
  const parsed = parseGitHubRepoEnv(process.env.GITHUB_REPO)
  if (!githubToken?.trim()) {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN is not configured. Required for creating repos.' },
      { status: 503 }
    )
  }
  if (!parsed) {
    return NextResponse.json(
      { error: 'GITHUB_REPO is not set or invalid. Use owner/repo.' },
      { status: 503 }
    )
  }
  const { owner } = parsed

  let body: { portfolioPath?: string; repoName?: string; name?: string; description?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const portfolioPath = body.portfolioPath?.trim()
  if (!portfolioPath) {
    return NextResponse.json(
      { error: 'Missing portfolioPath in body' },
      { status: 400 }
    )
  }

  if (await isPortfolioPathRegistered(portfolioPath)) {
    return NextResponse.json(
      { error: 'This portfolio path is already registered as a module (code-defined or custom).' },
      { status: 400 }
    )
  }

  const repoName = body.repoName?.trim() || deriveRepoName(portfolioPath)
  const displayName = (body.name?.trim() || portfolioPath.split('/').pop()) ?? portfolioPath
  const description = body.description?.trim() || undefined

  const headers: HeadersInit = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }

  // Check repo existence (GET repos/owner/repoName)
  const checkRes = await fetch(`${GITHUB_API}/repos/${owner}/${repoName}`, { headers })
  if (checkRes.status === 200) {
    return NextResponse.json(
      { error: 'Repository already exists; choose another name.' },
      { status: 400 }
    )
  }
  if (checkRes.status !== 404) {
    const err = (await checkRes.json().catch(() => ({}))) as { message?: string }
    return NextResponse.json(
      { error: err.message ?? `GitHub API error: ${checkRes.status}` },
      { status: checkRes.status >= 500 ? 502 : 400 }
    )
  }

  // Create repo: try org first, then user
  let createRes = await fetch(`${GITHUB_API}/orgs/${owner}/repos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: repoName,
      description: description ?? undefined,
      private: false,
    }),
  })
  if (createRes.status === 404) {
    createRes = await fetch(`${GITHUB_API}/user/repos`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repoName,
        description: description ?? undefined,
        private: false,
      }),
    })
  }

  if (!createRes.ok) {
    const err = (await createRes.json().catch(() => ({}))) as { message?: string }
    const message =
      createRes.status === 422
        ? 'Repository already exists or name invalid.'
        : err.message ?? `GitHub API error: ${createRes.status}`
    return NextResponse.json(
      { error: message },
      { status: createRes.status === 422 ? 400 : createRes.status >= 500 ? 502 : 400 }
    )
  }

  const repoData = (await createRes.json()) as { html_url?: string; clone_url?: string }
  const spunOffRepoUrl = repoData.html_url?.trim() || repoData.clone_url?.trim() || `https://github.com/${owner}/${repoName}`

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error; repo was created but could not save module.' },
      { status: 503 }
    )
  }

  const insertPayload = {
    name: displayName,
    portfolio_path: portfolioPath,
    spun_off_repo_url: spunOffRepoUrl,
    created_by: auth.user?.id ?? null,
  }

  let insertError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: inserted, error } = await supabaseAdmin
      .from('module_sync_custom')
      .insert(insertPayload)
      .select('id, name, portfolio_path, spun_off_repo_url')
      .single()
    if (!error && inserted) {
      console.info(
        `[module-sync] create-repo: created_by=${auth.user?.id ?? 'unknown'} portfolio_path=${portfolioPath} repo=${spunOffRepoUrl}`
      )
      return NextResponse.json(
        { module: { id: inserted.id, name: inserted.name, portfolio_path: inserted.portfolio_path, spun_off_repo_url: inserted.spun_off_repo_url } },
        { status: 201 }
      )
    }
    insertError = error as Error
  }

  return NextResponse.json(
    {
      error: 'Repository was created on GitHub but saving the module failed. You can add the module manually with the same path and repo URL.',
      repoUrl: spunOffRepoUrl,
    },
    { status: 500 }
  )
}
