import { describe, expect, it } from 'vitest'
import { generateAccessCode } from './proposal-access-code'

describe('generateAccessCode', () => {
  it('returns a 6-character code in the allowed charset', () => {
    const code = generateAccessCode()
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('never emits ambiguous characters across repeated generations', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateAccessCode()
      expect(code).toHaveLength(6)
      expect(code).not.toMatch(/[IO01]/)
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    }
  })
})
