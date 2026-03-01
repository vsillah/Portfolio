/**
 * USPS Addresses 3.0 API client (OAuth 2.0 + Address Standardization, City/State, ZIP Lookup).
 * Requires USPS Developer Portal app credentials (Consumer Key/Secret).
 * @see https://devs.usps.com/api/93 (Addresses 3.0)
 * @see https://devs.usps.com/api/81 (OAuth 2.0)
 */

const USPS_OAUTH_URL =
  process.env.USPS_OAUTH_URL || 'https://api.usps.com/oauth/v2/token'
const USPS_API_BASE =
  process.env.USPS_API_BASE || 'https://api.usps.com'

const ADDRESSES_PREFIX = '/addresses/v3'

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getAccessToken(): Promise<string> {
  const clientId = process.env.USPS_CLIENT_ID
  const clientSecret = process.env.USPS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('USPS_CLIENT_ID and USPS_CLIENT_SECRET must be set')
  }
  if (cachedToken && cachedToken.expires_at > Date.now() + 60_000) {
    return cachedToken.access_token
  }
  const res = await fetch(USPS_OAUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`USPS OAuth failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as {
    access_token: string
    expires_in?: number
  }
  const expiresIn = (data.expires_in ?? 3600) * 1000
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + expiresIn,
  }
  return cachedToken.access_token
}

async function uspsGet(path: string, params: Record<string, string>): Promise<Response> {
  const token = await getAccessToken()
  const search = new URLSearchParams(params).toString()
  const url = `${USPS_API_BASE}${ADDRESSES_PREFIX}${path}${search ? `?${search}` : ''}`
  return fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
}

/** Response from City/State Lookup (ZIP → city, state) */
export interface UspsCityStateResult {
  city: string
  state: string
  ZIPCode: string
}

/** Returns city and state for a 5-digit ZIP. */
export async function uspsCityStateLookup(zip5: string): Promise<UspsCityStateResult | null> {
  const zip = zip5.replace(/\D/g, '').slice(0, 5)
  if (zip.length !== 5) return null
  const res = await uspsGet('/city-state', { ZIPCode: zip })
  if (res.status === 404 || !res.ok) return null
  const data = (await res.json()) as UspsCityStateResult
  return data
}

/** Address fragment in USPS responses */
export interface UspsAddressFragment {
  streetAddress?: string
  streetAddressAbbreviation?: string
  secondaryAddress?: string
  city?: string
  cityAbbreviation?: string
  state?: string
  ZIPCode?: string
  ZIPPlus4?: string
  urbanization?: string
}

/** Response from ZIP Code Lookup (city + state → ZIP). */
export interface UspsZipCodeResult {
  firm?: string
  address?: UspsAddressFragment
}

/** Returns ZIP (and optional ZIP+4) for city, state, and optional street. */
export async function uspsZipCodeLookup(
  city: string,
  state: string,
  streetAddress?: string,
  secondaryAddress?: string
): Promise<UspsZipCodeResult | null> {
  const state2 = state.trim().toUpperCase().slice(0, 2)
  if (!city?.trim() || state2.length !== 2) return null
  const params: Record<string, string> = {
    city: city.trim(),
    state: state2,
    streetAddress: (streetAddress ?? '').trim() || '0', // USPS may require non-empty
  }
  if (secondaryAddress?.trim()) params.secondaryAddress = secondaryAddress.trim()
  const res = await uspsGet('/zipcode', params)
  if (res.status === 404 || !res.ok) return null
  const data = (await res.json()) as UspsZipCodeResult
  return data
}

/** Response from Address Standardization */
export interface UspsStandardizeResult {
  firm?: string
  address?: UspsAddressFragment
  additionalInfo?: {
    deliveryPoint?: string
    carrierRoute?: string
    DPVConfirmation?: string
    DPVCMRA?: string
    business?: string
    centralDeliveryPoint?: string
    vacant?: string
  }
  corrections?: Array<{ code: string; text: string }>
  matches?: Array<{ code: string; text: string }>
  warnings?: string[]
}

/** Validates and standardizes a US address. Requires street, state, and city or ZIP. */
export async function uspsStandardizeAddress(params: {
  streetAddress: string
  secondaryAddress?: string
  city?: string
  state: string
  ZIPCode?: string
  ZIPPlus4?: string
  firm?: string
  urbanization?: string
}): Promise<UspsStandardizeResult | null> {
  const { streetAddress, state } = params
  const street = (streetAddress ?? '').trim()
  const state2 = (state ?? '').trim().toUpperCase().slice(0, 2)
  if (!street || state2.length !== 2) return null
  if (!params.city?.trim() && !params.ZIPCode?.trim()) return null

  const q: Record<string, string> = {
    streetAddress: street,
    state: state2,
  }
  if (params.city?.trim()) q.city = params.city.trim()
  if (params.ZIPCode?.trim()) q.ZIPCode = params.ZIPCode.replace(/\D/g, '').slice(0, 5)
  if (params.secondaryAddress?.trim()) q.secondaryAddress = params.secondaryAddress.trim()
  if (params.ZIPPlus4?.trim()) q.ZIPPlus4 = params.ZIPPlus4.replace(/\D/g, '').slice(0, 4)
  if (params.firm?.trim()) q.firm = params.firm.trim()
  if (params.urbanization?.trim()) q.urbanization = params.urbanization.trim()

  const res = await uspsGet('/address', q)
  if (res.status === 404 || res.status === 400) return null
  if (!res.ok) throw new Error(`USPS address standardization failed: ${res.status}`)
  const data = (await res.json()) as UspsStandardizeResult
  return data
}
