import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AGENT_ORGANIZATION } from '@/lib/agent-organization'
import { AGENT_AVATARS, getMissingAgentAvatarKeys, resolveAgentAvatarImageSrc } from '@/lib/agent-avatars'

describe('agent avatar manifest', () => {
  it('covers every stable agent organization key', () => {
    expect(getMissingAgentAvatarKeys()).toEqual([])
  })

  it('provides accessible labels for every organization avatar', () => {
    for (const agent of AGENT_ORGANIZATION) {
      expect(AGENT_AVATARS[agent.key]?.label).toContain('Illustrated avatar')
      expect(AGENT_AVATARS[agent.key]?.initials.length).toBeGreaterThan(1)
      expect(AGENT_AVATARS[agent.key]?.imagePath).toBe(`/agent-avatars/baroque/${agent.key}.png`)
    }
  })

  it('has generated static portrait assets for every organization avatar', () => {
    for (const agent of AGENT_ORGANIZATION) {
      const assetPath = AGENT_AVATARS[agent.key]?.imagePath
      expect(assetPath).toBeTruthy()
      expect(existsSync(path.join(process.cwd(), 'public', assetPath))).toBe(true)
    }
    expect(existsSync(path.join(process.cwd(), 'public', 'agent-avatars', 'unknown.svg'))).toBe(true)
  })

  it('can resolve avatar assets through a public base URL for protected deployments', () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL
    process.env.NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL = 'https://assets.example.com/'

    expect(resolveAgentAvatarImageSrc('/agent-avatars/baroque/chief-of-staff.png')).toBe(
      'https://assets.example.com/agent-avatars/baroque/chief-of-staff.png',
    )

    if (originalBaseUrl === undefined) {
      delete process.env.NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL
    } else {
      process.env.NEXT_PUBLIC_AGENT_AVATAR_ASSET_BASE_URL = originalBaseUrl
    }
  })
})
