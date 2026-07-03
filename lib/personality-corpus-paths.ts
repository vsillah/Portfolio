import { existsSync } from 'fs'
import path from 'path'

export const LEGACY_PERSONALITY_CORPUS_HOME = '/Users/vambahsillah/Documents/Codex/2026-04-30/i-have-quite-a-bit-of/personality-corpus'

export interface PersonalityCorpusPaths {
  portfolioRoot: string
  preferredHome: string
  legacyHome: string
  activeHome: string
  activeSource: 'env' | 'portfolio_local' | 'legacy_codex'
  publicSafeRagPack: string
  voiceGuide: string
  personalityProfile: string
  rawPrivateExportsHome: string
  exists: boolean
}

export function resolvePersonalityCorpusPaths(options: {
  portfolioRoot?: string
  envHome?: string | null
} = {}): PersonalityCorpusPaths {
  const portfolioRoot = path.resolve(options.portfolioRoot || process.env.OPEN_BRAIN_PORTFOLIO_ROOT || process.cwd())
  const preferredHome = path.join(portfolioRoot, '.local/personality-corpus')
  const envHome = options.envHome ?? process.env.PERSONALITY_CORPUS_HOME ?? null
  const activeHome = envHome && existsSync(envHome)
    ? envHome
    : existsSync(preferredHome)
      ? preferredHome
      : LEGACY_PERSONALITY_CORPUS_HOME
  const activeSource = envHome && existsSync(envHome)
    ? 'env'
    : activeHome === preferredHome
      ? 'portfolio_local'
      : 'legacy_codex'

  return {
    portfolioRoot,
    preferredHome,
    legacyHome: LEGACY_PERSONALITY_CORPUS_HOME,
    activeHome,
    activeSource,
    publicSafeRagPack: path.join(activeHome, 'rag-ready/vambah_personality_public_safe.md'),
    voiceGuide: path.join(activeHome, 'voice_and_style_guide.md'),
    personalityProfile: path.join(activeHome, 'personality_profile.md'),
    rawPrivateExportsHome: path.join(activeHome, 'raw-exports'),
    exists: existsSync(activeHome),
  }
}
