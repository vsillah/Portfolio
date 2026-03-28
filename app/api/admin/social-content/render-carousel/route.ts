import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { renderCarousel } from '@/lib/carousel'
import type { CarouselSlide } from '@/lib/social-content'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/social-content/render-carousel
 * Render carousel slides JSON into PNGs + PDF, upload to Supabase Storage.
 *
 * Auth: verifyAdmin (admin UI) OR Bearer N8N_INGEST_SECRET (n8n webhook)
 *
 * Body: { content_id: string, carousel_slides?: CarouselSlide[] }
 * If carousel_slides is not provided, reads from the DB row.
 */
export async function POST(request: NextRequest) {
  try {
    const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
    const isN8nAuth = bearerToken === process.env.N8N_INGEST_SECRET

    if (!isN8nAuth) {
      const authResult = await verifyAdmin(request)
      if (isAuthError(authResult)) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status })
      }
    }

    const body = await request.json()
    const { content_id } = body
    let { carousel_slides } = body as { carousel_slides?: CarouselSlide[] }

    if (!content_id) {
      return NextResponse.json({ error: 'content_id is required' }, { status: 400 })
    }

    if (!carousel_slides || !Array.isArray(carousel_slides) || carousel_slides.length === 0) {
      const { data: row } = await supabaseAdmin
        .from('social_content_queue')
        .select('carousel_slides')
        .eq('id', content_id)
        .single()

      if (!row?.carousel_slides) {
        return NextResponse.json({ error: 'No carousel_slides found for this content' }, { status: 400 })
      }
      carousel_slides = row.carousel_slides as CarouselSlide[]
    }

    const { pngBuffers, pdfBuffer } = await renderCarousel(carousel_slides)

    const slideUrls: string[] = []
    const storageBase = `carousels/${content_id}`

    for (let i = 0; i < pngBuffers.length; i++) {
      const fileName = `${storageBase}/slide_${String(i + 1).padStart(2, '0')}.png`
      const { error: uploadErr } = await supabaseAdmin.storage
        .from('social-content')
        .upload(fileName, pngBuffers[i], {
          contentType: 'image/png',
          upsert: true,
        })

      if (uploadErr) {
        console.error(`Failed to upload slide ${i + 1}:`, uploadErr)
        continue
      }

      const { data: publicUrl } = supabaseAdmin.storage
        .from('social-content')
        .getPublicUrl(fileName)

      slideUrls.push(publicUrl.publicUrl)
    }

    const pdfFileName = `${storageBase}/carousel.pdf`
    const { error: pdfUploadErr } = await supabaseAdmin.storage
      .from('social-content')
      .upload(pdfFileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    let pdfUrl: string | null = null
    if (!pdfUploadErr) {
      const { data: publicUrl } = supabaseAdmin.storage
        .from('social-content')
        .getPublicUrl(pdfFileName)
      pdfUrl = publicUrl.publicUrl
    } else {
      console.error('Failed to upload PDF:', pdfUploadErr)
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({
        carousel_slide_urls: slideUrls,
        carousel_pdf_url: pdfUrl,
        content_format: 'carousel',
      })
      .eq('id', content_id)

    return NextResponse.json({
      success: true,
      carousel_slide_urls: slideUrls,
      carousel_pdf_url: pdfUrl,
      slide_count: pngBuffers.length,
    })
  } catch (error) {
    console.error('Error in render-carousel:', error)
    return NextResponse.json(
      { error: 'Failed to render carousel. Please try again.' },
      { status: 500 }
    )
  }
}
