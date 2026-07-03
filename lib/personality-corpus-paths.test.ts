import { mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  LEGACY_PERSONALITY_CORPUS_HOME,
  resolvePersonalityCorpusPaths,
} from './personality-corpus-paths'

const tempRoots: string[] = []

async function makeTempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'personality-corpus-paths-'))
  tempRoots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('resolvePersonalityCorpusPaths', () => {
  it('prefers the Portfolio-local personality corpus when present', async () => {
    const root = await makeTempRoot()
    const localCorpus = path.join(root, '.local/personality-corpus')
    await mkdir(localCorpus, { recursive: true })

    const paths = resolvePersonalityCorpusPaths({ portfolioRoot: root })

    expect(paths.activeHome).toBe(localCorpus)
    expect(paths.activeSource).toBe('portfolio_local')
    expect(paths.publicSafeRagPack).toBe(path.join(localCorpus, 'rag-ready/vambah_personality_public_safe.md'))
    expect(paths.rawPrivateExportsHome).toBe(path.join(localCorpus, 'raw-exports'))
    expect(paths.exists).toBe(true)
  })

  it('uses an explicit env home when it exists', async () => {
    const root = await makeTempRoot()
    const envHome = path.join(root, 'custom-corpus')
    await mkdir(envHome, { recursive: true })

    const paths = resolvePersonalityCorpusPaths({ portfolioRoot: root, envHome })

    expect(paths.activeHome).toBe(envHome)
    expect(paths.activeSource).toBe('env')
  })

  it('falls back to the legacy Codex path when local homes are absent', async () => {
    const root = await makeTempRoot()

    const paths = resolvePersonalityCorpusPaths({ portfolioRoot: root, envHome: null })

    expect(paths.activeHome).toBe(LEGACY_PERSONALITY_CORPUS_HOME)
    expect(paths.activeSource).toBe('legacy_codex')
  })
})
