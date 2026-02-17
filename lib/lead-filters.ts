/**
 * Helpers to filter out non-person leads (e.g. companies, pages) during ingest
 * so they are not pushed to the lead dashboard from Facebook/Google Contacts.
 */

const ORG_SUFFIXES = [
  /\s+Inc\.?$/i,
  /\s+LLC\.?$/i,
  /\s+L\.?L\.?C\.?$/i,
  /\s+Ltd\.?$/i,
  /\s+Limited$/i,
  /\s+Corp\.?$/i,
  /\s+Corporation$/i,
  /\s+Co\.?$/i,
  /\s+Company$/i,
  /\s+Group$/i,
  /\s+Solutions$/i,
  /\s+Technologies$/i,
  /\s+Systems$/i,
  /\s+Media$/i,
  /\s+Studio$/i,
  /\s+Official\s*Page$/i,
  /\s+Page$/i,
  /^(.+)\s+-\s+Official\s*$/i,
]

/**
 * Returns true if the name looks like an organization/business rather than a person.
 * Used to skip company pages or business contacts during warm lead ingest.
 */
export function isLikelyOrganization(name: string, company?: string | null): boolean {
  const n = (name || '').trim()
  if (!n) return true

  // Name is exactly the company name and looks like org
  if (company && n.toLowerCase() === company.trim().toLowerCase()) {
    if (ORG_SUFFIXES.some((re) => re.test(n))) return true
    if (n === n.toUpperCase() && n.length > 2) return true
  }

  // Common organization name patterns
  if (ORG_SUFFIXES.some((re) => re.test(n))) return true

  // All caps and long enough to be a brand (e.g. "ACME CORP")
  if (n === n.toUpperCase() && n.length >= 4 && !n.includes(' ')) return true

  // Multiple words all caps (e.g. "SOME COMPANY NAME")
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length >= 2 && words.every((w) => w === w.toUpperCase() && w.length >= 2)) return true

  return false
}
