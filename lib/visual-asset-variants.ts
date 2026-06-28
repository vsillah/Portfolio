export type ThemeImageVariants = {
  dark?: string | null
  light?: string | null
}

export type ThemeName = 'dark' | 'light'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function cleanUrl(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function resolveThemeImageUrl(input: {
  imageUrl?: string | null
  imageVariants?: ThemeImageVariants | Record<string, unknown> | null
  theme?: string | null
}) {
  const theme: ThemeName = input.theme === 'light' ? 'light' : 'dark'
  const variants = isRecord(input.imageVariants) ? input.imageVariants : {}
  return cleanUrl(variants[theme]) ?? cleanUrl(input.imageUrl)
}
