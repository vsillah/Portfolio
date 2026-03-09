import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

async function loadUspsModule() {
  vi.resetModules()
  return import('./usps')
}

describe('lib/usps', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    process.env.USPS_CLIENT_ID = 'test-client-id'
    process.env.USPS_CLIENT_SECRET = 'test-client-secret'
    delete process.env.USPS_OAUTH_URL
    delete process.env.USPS_API_BASE
  })

  it('returns null for invalid ZIP input without calling USPS', async () => {
    const usps = await loadUspsModule()

    const result = await usps.uspsCityStateLookup('12')

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes ZIP input and calls city/state lookup', async () => {
    const usps = await loadUspsModule()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ city: 'Austin', state: 'TX', ZIPCode: '78701' }), { status: 200 })
      )

    const result = await usps.uspsCityStateLookup('78701-1234')

    expect(result).toEqual({ city: 'Austin', state: 'TX', ZIPCode: '78701' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/addresses/v3/city-state?ZIPCode=78701'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('uses default streetAddress=0 in ZIP code lookup when street is missing', async () => {
    const usps = await loadUspsModule()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ address: { ZIPCode: '10001', ZIPPlus4: '1234' } }), { status: 200 })
      )

    const result = await usps.uspsZipCodeLookup('New York', 'ny')

    expect(result).toEqual({ address: { ZIPCode: '10001', ZIPPlus4: '1234' } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/addresses/v3/zipcode?city=New+York&state=NY&streetAddress=0'),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('reuses cached OAuth token between USPS API calls', async () => {
    const usps = await loadUspsModule()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ city: 'Austin', state: 'TX', ZIPCode: '78701' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ address: { ZIPCode: '78701' } }), { status: 200 })
      )

    await usps.uspsCityStateLookup('78701')
    await usps.uspsZipCodeLookup('Austin', 'TX')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.usps.com/oauth/v2/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('returns null when address standardization lacks both city and ZIP', async () => {
    const usps = await loadUspsModule()

    const result = await usps.uspsStandardizeAddress({
      streetAddress: '123 Main St',
      state: 'TX',
    })

    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sanitizes standardize params and returns null on 400', async () => {
    const usps = await loadUspsModule()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'invalid' }), { status: 400 }))

    const result = await usps.uspsStandardizeAddress({
      streetAddress: ' 123 Main St ',
      city: ' Austin ',
      state: ' tx ',
      ZIPCode: '78701-1234',
      ZIPPlus4: '1234-99',
      secondaryAddress: ' Apt 2 ',
    })

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        '/addresses/v3/address?streetAddress=123+Main+St&state=TX&city=Austin&ZIPCode=78701&secondaryAddress=Apt+2&ZIPPlus4=1234'
      ),
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('throws on non-400/404 USPS standardization failures', async () => {
    const usps = await loadUspsModule()
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-1', expires_in: 3600 }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'server-error' }), { status: 500 }))

    await expect(
      usps.uspsStandardizeAddress({
        streetAddress: '123 Main St',
        city: 'Austin',
        state: 'TX',
      })
    ).rejects.toThrow('USPS address standardization failed: 500')
  })
})
