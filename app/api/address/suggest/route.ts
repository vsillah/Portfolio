import { NextRequest, NextResponse } from 'next/server'
import { uspsCityStateLookup, uspsZipCodeLookup } from '@/lib/usps'

export const dynamic = 'force-dynamic'

/**
 * GET /api/address/suggest
 * - ?zip=12345 → returns { city, state, ZIPCode } for autofill
 * - ?city=X&state=Y → returns { zip, zip4?, city, state } from ZIP lookup (optional &streetAddress=, &address2=)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const zip = searchParams.get('zip')?.replace(/\D/g, '').slice(0, 5)
    const city = searchParams.get('city')?.trim()
    const state = searchParams.get('state')?.trim().toUpperCase().slice(0, 2)

    if (!process.env.USPS_CLIENT_ID || !process.env.USPS_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Address suggestions are not configured.' },
        { status: 503 }
      )
    }

    if (zip && zip.length === 5) {
      const result = await uspsCityStateLookup(zip)
      if (!result) {
        return NextResponse.json({ city: null, state: null, ZIPCode: zip })
      }
      return NextResponse.json({
        city: result.city,
        state: result.state,
        ZIPCode: result.ZIPCode,
      })
    }

    if (city && state && state.length === 2) {
      const street = searchParams.get('streetAddress')?.trim()
      const address2 = searchParams.get('address2')?.trim()
      const result = await uspsZipCodeLookup(
        city,
        state,
        street || undefined,
        address2 || undefined
      )
      if (!result?.address) {
        return NextResponse.json({ zip: null, zip4: null, city: null, state: null })
      }
      const a = result.address
      const zip5 = (a.ZIPCode ?? '').trim()
      const zip4 = (a.ZIPPlus4 ?? '').trim()
      return NextResponse.json({
        zip: zip5,
        zip4: zip4 || undefined,
        city: a.city ?? city,
        state: a.state ?? state,
      })
    }

    return NextResponse.json(
      { error: 'Provide either zip=12345 or city=...&state=...' },
      { status: 400 }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    console.error('[address/suggest]', err)
    // USPS OAuth or API returned 503/502 → treat as temporary outage
    if (message.includes('503') || message.includes('502') || message.includes('Service Unavailable')) {
      return NextResponse.json(
        { error: 'Address lookup is temporarily unavailable. Please try again in a moment.' },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Could not fetch address suggestions.' },
      { status: 500 }
    )
  }
}
