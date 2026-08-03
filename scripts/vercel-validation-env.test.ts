import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  execFileSync: vi.fn(),
}))

vi.mock('node:child_process', () => ({
  execFileSync: mocks.execFileSync,
  default: {
    execFileSync: mocks.execFileSync,
  },
}))

import {
  getVercelAutomationBypassSecretForBaseUrl,
  getVercelEnvTargetForBaseUrl,
  getVercelProjectEnvValuesForBaseUrl,
} from './vercel-validation-env'

describe('vercel validation env helpers', () => {
  let tempRoot: string
  let canonicalRoot: string
  let worktreeRoot: string

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-vercel-env-'))
    canonicalRoot = path.join(tempRoot, 'Portfolio')
    worktreeRoot = path.join(tempRoot, 'Portfolio.worktrees', 'captain-current')
    fs.mkdirSync(path.join(canonicalRoot, '.vercel'), { recursive: true })
    fs.mkdirSync(worktreeRoot, { recursive: true })
    fs.writeFileSync(
      path.join(canonicalRoot, '.vercel', 'project.json'),
      JSON.stringify({ orgId: 'team_1', projectId: 'prj_portfolio' }),
    )

    mocks.execFileSync.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('resolves a staging alias to the staging project production env from a sibling worktree', () => {
    mocks.execFileSync.mockImplementation((_command, args) => {
      const endpoint = args[1]
      if (endpoint === '/v13/deployments/portfolio-staging-vsillahs-projects.vercel.app?teamId=team_1') {
        return JSON.stringify({
          projectId: 'prj_staging',
          target: 'production',
        })
      }
      if (endpoint === '/v10/projects/prj_staging/env?teamId=team_1') {
        return JSON.stringify({
          envs: [
            { key: 'NEXT_PUBLIC_SUPABASE_URL', id: 'env_url', target: ['production'] },
            { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', id: 'env_anon', target: ['production'] },
          ],
        })
      }
      if (endpoint === '/v1/projects/prj_staging/env/env_url?teamId=team_1') {
        return JSON.stringify({ value: 'https://staging-ref.supabase.co' })
      }
      if (endpoint === '/v1/projects/prj_staging/env/env_anon?teamId=team_1') {
        return JSON.stringify({ value: 'public-anon-key' })
      }
      throw new Error(`unexpected endpoint ${endpoint}`)
    })

    const values = getVercelProjectEnvValuesForBaseUrl(
      ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      'https://portfolio-staging-vsillahs-projects.vercel.app',
      worktreeRoot,
    )

    expect(values).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: 'https://staging-ref.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
    })
  })

  it('uses the URL-resolved project when looking up a Vercel bypass env var', () => {
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', '')
    mocks.execFileSync.mockImplementation((_command, args) => {
      const endpoint = args[1]
      if (endpoint === '/v13/deployments/portfolio-staging-vsillahs-projects.vercel.app?teamId=team_1') {
        return JSON.stringify({
          projectId: 'prj_staging',
          target: 'production',
        })
      }
      if (endpoint === '/v9/projects/prj_staging?teamId=team_1') {
        return JSON.stringify({
          protectionBypass: {
            staging_bypass_secret: { isEnvVar: true },
          },
        })
      }
      throw new Error(`unexpected endpoint ${endpoint}`)
    })

    expect(
      getVercelAutomationBypassSecretForBaseUrl(
        'https://portfolio-staging-vsillahs-projects.vercel.app',
        worktreeRoot,
      ),
    ).toBe('staging_bypass_secret')
  })

  it('still treats custom domains as production and branch Vercel URLs as preview', () => {
    expect(getVercelEnvTargetForBaseUrl('https://amadutown.com')).toBe('production')
    expect(getVercelEnvTargetForBaseUrl('https://portfolio-git-example.vercel.app')).toBe('preview')
    expect(getVercelEnvTargetForBaseUrl('http://localhost:3000')).toBeUndefined()
  })
})
