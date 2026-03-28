import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { verifyAdmin, isAuthError } from '@/lib/auth-server'
import { renderCarousel } from '@/lib/carousel'
import type { CarouselSlide } from '@/lib/social-content'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/admin/social-content/[id]/convert-to-carousel
 * Convert a single-image post to a carousel.
 * Generates carousel_slides JSON via OpenAI from existing post content,
 * then renders PNGs + PDF and uploads to Supabase Storage.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await verifyAdmin(request)
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status })
    }

    const { id } = params

    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('social_content_queue')
      .select('post_text, topic_extracted, hormozi_framework, hashtags')
      .eq('id', id)
      .single()

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 })
    }

    const { getSocialCarouselSlidesPrompt } = await import('@/lib/system-prompts')
    const systemPrompt = await getSocialCarouselSlidesPrompt()

    const topicData = row.topic_extracted as Record<string, unknown> | null
    const userMessage = `Topic: ${topicData?.topic || 'N/A'}
Key Insight: ${topicData?.key_insight || 'N/A'}
Personal Tie-In: ${topicData?.personal_tie_in || 'N/A'}
Hormozi Framework: ${JSON.stringify(row.hormozi_framework || {})}
Post Text: ${row.post_text}
Hashtags: ${(row.hashtags || []).join(', ')}`

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      }),
    })

    if (!aiResponse.ok) {
      console.error('OpenAI API error:', await aiResponse.text())
      return NextResponse.json({ error: 'Failed to generate carousel content' }, { status: 502 })
    }

    const aiData = await aiResponse.json()
    const rawContent = aiData.choices?.[0]?.message?.content
    let slides: CarouselSlide[]

    try {
      const parsed = JSON.parse(rawContent)
      slides = Array.isArray(parsed) ? parsed : parsed.slides || []
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI-generated slides' }, { status: 502 })
    }

    if (slides.length < 3) {
      return NextResponse.json({ error: 'AI generated too few slides' }, { status: 502 })
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({ carousel_slides: slides })
      .eq('id', id)

    const { pngBuffers, pdfBuffer } = await renderCarousel(slides)

    const slideUrls: string[] = []
    const storageBase = `carousels/${id}`

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
    let pdfUrl: string | null = null
    const { error: pdfUploadErr } = await supabaseAdmin.storage
      .from('social-content')
      .upload(pdfFileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (!pdfUploadErr) {
      const { data: publicUrl } = supabaseAdmin.storage
        .from('social-content')
        .getPublicUrl(pdfFileName)
      pdfUrl = publicUrl.publicUrl
    }

    await supabaseAdmin
      .from('social_content_queue')
      .update({
        content_format: 'carousel',
        carousel_slide_urls: slideUrls,
        carousel_pdf_url: pdfUrl,
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      content_format: 'carousel',
      carousel_slides: slides,
      carousel_slide_urls: slideUrls,
      carousel_pdf_url: pdfUrl,
      slide_count: slides.length,
    })
  } catch (error) {
    console.error('Error in convert-to-carousel:', error)
    return NextResponse.json(
      { error: 'Failed to convert to carousel. Please try again.' },
      { status: 500 }
    )
  }
}
