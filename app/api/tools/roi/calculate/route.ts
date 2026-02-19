import { NextRequest, NextResponse } from 'next/server'
import {
  calculateTimeSaved,
  calculateROI,
} from '@/lib/value-calculations'

export const dynamic = 'force-dynamic'

type Body = {
  hoursPerWeek?: number
  hourlyRate?: number
  weeksPerYear?: number
  offerPrice?: number
}

/**
 * Runs the time-saved value calculation and optional ROI.
 * POST /api/tools/roi/calculate
 * Body: { hoursPerWeek, hourlyRate, weeksPerYear?, offerPrice? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const hoursPerWeek = Number(body.hoursPerWeek) || 0
    const hourlyRate = Number(body.hourlyRate) || 0
    const weeksPerYear = Number(body.weeksPerYear) || 52
    const offerPrice = body.offerPrice != null ? Number(body.offerPrice) : undefined

    const result = calculateTimeSaved({
      hoursPerWeek,
      hourlyRate,
      weeksPerYear,
    })

    const annualValue = result.annualValue
    const out: {
      annualValue: number
      formulaReadable: string
      roi?: number
      roiFormatted?: string
      paybackFormatted?: string
      netFirstYearValue?: number
    } = {
      annualValue,
      formulaReadable: result.formulaReadable,
    }

    if (offerPrice != null && offerPrice > 0) {
      const roiResult = calculateROI(annualValue, offerPrice)
      out.roi = roiResult.roi
      out.roiFormatted = roiResult.roiFormatted
      out.paybackFormatted = roiResult.paybackFormatted
      out.netFirstYearValue = roiResult.netFirstYearValue
    }

    return NextResponse.json(out)
  } catch (err) {
    console.error('ROI calculate:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
