/**
 * Derive a video folder slug from a Drive file name.
 * Used for B-roll output structure: design-files/broll/{slug}/B-roll/
 */

/**
 * Convert a Drive file name (e.g. "Episode 1 script.txt", "ATAS-EP3-draft.md")
 * to a slug suitable for folder names (e.g. "episode-1-script", "atas-ep3-draft").
 */
export function videoSlugFromFileName(driveFileName: string): string {
  if (!driveFileName || typeof driveFileName !== 'string') {
    return 'video-' + Date.now()
  }
  const ext = driveFileName.lastIndexOf('.')
  const base = ext > 0 ? driveFileName.slice(0, ext) : driveFileName
  return base
    .replace(/[^a-zA-Z0-9\s-_]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'video-' + Date.now()
}
