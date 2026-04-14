/**
 * Build Gmail web compose URLs. Long bodies exceed practical GET limits;
 * callers should omit body from the URL and copy it to the clipboard instead.
 */
export const GMAIL_COMPOSE_MAX_URL_LENGTH = 1800

export function buildGmailComposeUrl(
  to: string,
  subject: string,
  body: string
): { url: string; omitBodyFromUrl: boolean } {
  const base = 'https://mail.google.com/mail/?view=cm&fs=1'
  const fullParams = new URLSearchParams({ to, su: subject, body })
  const full = `${base}&${fullParams.toString()}`
  if (full.length <= GMAIL_COMPOSE_MAX_URL_LENGTH) {
    return { url: full, omitBodyFromUrl: false }
  }
  const shortParams = new URLSearchParams({ to, su: subject })
  return { url: `${base}&${shortParams.toString()}`, omitBodyFromUrl: true }
}
