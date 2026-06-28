import { describe, expect, it } from 'vitest'
import { resolveThemeImageUrl } from './visual-asset-variants'

describe('resolveThemeImageUrl', () => {
  it('prefers the active theme variant over the fallback image', () => {
    expect(resolveThemeImageUrl({
      imageUrl: 'https://example.com/default.png',
      imageVariants: {
        dark: 'https://example.com/dark.png',
        light: 'https://example.com/light.png',
      },
      theme: 'light',
    })).toBe('https://example.com/light.png')
  })

  it('falls back to image_url when the requested theme variant is missing', () => {
    expect(resolveThemeImageUrl({
      imageUrl: 'https://example.com/default.png',
      imageVariants: { dark: 'https://example.com/dark.png' },
      theme: 'light',
    })).toBe('https://example.com/default.png')
  })
})
