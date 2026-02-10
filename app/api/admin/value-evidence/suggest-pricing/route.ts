import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { getSuggestedPricing } from '@/lib/value-report-generator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/value-evidence/suggest-pricing
 * 
 * Returns evidence-backed anchor prices for a product/service.
 * Used by ProductClassifier and BundleEditor to suggest retail_price and perceived_value.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin(request)
  if (isAuthError(auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const { content_type, content_id, industry, company_size, contact_submission_id } = body

  if (!content_type || !content_id) {
    return NextResponse.json(
      { error: 'content_type and content_id are required' },
      { status: 400 }
    )
  }

  try {
    const pricing = await getSuggestedPricing({
      contentType: content_type,
      contentId: content_id,
      industry,
      companySize: company_size,
      contactSubmissionId: contact_submission_id,
    })

    if (!pricing) {
      return NextResponse.json(
        {
          error: 'No pricing suggestions available',
          detail: 'This content has no pain points mapped. Map pain points in the Value Evidence admin page first.',
        },
        { status: 422 }
      )
    }

    return NextResponse.json({ pricing })
  } catch (error: any) {
    console.error('Suggest pricing error:', error)
    return NextResponse.json(
      { error: 'Failed to generate pricing suggestion', details: error.message },
      { status: 500 }
    )
  }
}
