import { NextRequest, NextResponse } from 'next/server'
import { uspsStandardizeAddress } from '@/lib/usps'

export const dynamic = 'force-dynamic'

function mapUspsToForm(addr: {
  streetAddress?: string
  secondaryAddress?: string
  city?: string
  state?: string
  ZIPCode?: string
  ZIPPlus4?: string
}): {
  address1: string
  address2: string
  city: string
  state_code: string
  zip: string
  zip4?: string
} {
  const primary = (addr.streetAddress ?? '').trim()
  const secondary = (addr.secondaryAddress ?? '').trim()
  const zip4 = (addr.ZIPPlus4 ?? '').trim()
  const zip = ((addr.ZIPCode ?? '').trim() + (zip4 ? `-${zip4}` : '')).slice(0, 10)
  return {
    address1: primary || '',
    address2: secondary,
    city: (addr.city ?? '').trim(),
    state_code: (addr.state ?? '').trim().toUpperCase().slice(0, 2),
    zip: zip.replace(/-+$/, ''),
    ...(zip4 ? { zip4 } : undefined),
  }
}

/**
 * POST /api/address/validate
 * Body: { address1, address2?, city, state_code, zip, country_code }
 * US only. Returns standardized address or validation message.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { address1, address2, city, state_code, zip, country_code } = body

    if (country_code !== 'US' && country_code !== undefined && country_code !== '') {
      return NextResponse.json({
        valid: false,
        message: 'Address validation is only available for US addresses.',
      })
    }

    const street = (address1 ?? '').trim()
    const state = (state_code ?? '').trim().toUpperCase().slice(0, 2)
    if (!street || !state) {
      return NextResponse.json({
        valid: false,
        message: 'Street address and state are required.',
      })
    }
    const zip5 = (zip ?? '').replace(/\D/g, '').slice(0, 5)
    if (!(city ?? '').trim() && zip5.length !== 5) {
      return NextResponse.json({
        valid: false,
        message: 'Either city or ZIP code is required.',
      })
    }

    if (!process.env.USPS_CLIENT_ID || !process.env.USPS_CLIENT_SECRET) {
      return NextResponse.json(
        { valid: false, message: 'Address validation is not configured.' },
        { status: 503 }
      )
    }

    const result = await uspsStandardizeAddress({
      streetAddress: street,
      secondaryAddress: (address2 ?? '').trim() || undefined,
      city: (city ?? '').trim() || undefined,
      state,
      ZIPCode: zip5.length === 5 ? zip5 : undefined,
    })

    if (!result) {
      return NextResponse.json({
        valid: false,
        message: 'Address could not be validated. Please check the address and try again.',
      })
    }

    const addr = result.address
    if (!addr) {
      return NextResponse.json({
        valid: false,
        message: result.warnings?.join(' ') || 'Address could not be standardized.',
      })
    }

    const standardized = mapUspsToForm(addr)
    return NextResponse.json({
      valid: true,
      standardized,
      corrections: result.corrections,
      warnings: result.warnings,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Validation failed.'
    console.error('[address/validate]', err)
    const isUspsOutage = message.includes('503') || message.includes('502') || message.includes('Service Unavailable')
    const userMessage = isUspsOutage
      ? 'Address validation is temporarily unavailable. Please try again in a moment.'
      : message.includes('USPS') ? message : 'Something went wrong. Please try again.'
    return NextResponse.json(
      { valid: false, message: userMessage },
      { status: isUspsOutage ? 503 : 500 }
    )
  }
}
