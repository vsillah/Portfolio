import { createClient } from '@supabase/supabase-js'

// Absence of privileged configuration disables the testing routes. Never fall
// back to an anon key: these operations require the service-role client.
function getTestingDatabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  } catch {
    return null
  }

  return { url, key }
}

export function isTestingDatabaseConfigured(): boolean {
  return getTestingDatabaseConfiguration() !== null
}

// Read configuration per request; importing routes must not create a client.
export function getTestingSupabaseClient() {
  const config = getTestingDatabaseConfiguration()
  return config ? createClient(config.url, config.key) : null
}
