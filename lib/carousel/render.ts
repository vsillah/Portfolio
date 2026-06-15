/**
 * Carousel rendering pipeline:
 * 1. Generate self-contained HTML from slide JSON
 * 2. Render each slide to PNG via Playwright (headless Chromium)
 * 3. Combine PNGs into a single PDF via pdf-lib
 *
 * Uses @sparticuz/chromium for Vercel/Lambda compatibility and Playwright's
 * installed browser for local development.
 */

import { PDFDocument, PDFImage } from 'pdf-lib'
import type { CarouselSlide } from '@/lib/social-content'
import { generateCarouselHTML } from './templates'

const SLIDE_SIZE = 1080

function shouldUseServerlessChromium(): boolean {
  return Boolean(
    process.env.VERCEL
    || process.env.AWS_LAMBDA_FUNCTION_NAME
    || process.env.AWS_EXECUTION_ENV
  )
}

async function launchCarouselBrowser() {
  if (shouldUseServerlessChromium()) {
    const chromium = await import('@sparticuz/chromium')
    const { chromium: playwrightChromium } = await import('playwright-core')
    const executablePath = await chromium.default.executablePath()

    return playwrightChromium.launch({
      args: chromium.default.args,
      executablePath,
      headless: true,
    })
  }

  const { chromium: playwrightChromium } = await import('playwright')
  return playwrightChromium.launch({ headless: true })
}

/**
 * Render carousel slides to PNG buffers using Playwright.
 * Each buffer is a 1080x1080 PNG screenshot of one slide.
 */
export async function renderCarouselSlides(
  slides: CarouselSlide[]
): Promise<Buffer[]> {
  const html = generateCarouselHTML(slides)
  const total = slides.length

  const browser = await launchCarouselBrowser()

  try {
    const page = await browser.newPage({
      viewport: { width: SLIDE_SIZE, height: SLIDE_SIZE },
    })

    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const pngBuffers: Buffer[] = []

    for (let i = 0; i < total; i++) {
      await page.evaluate((n: number) => {
        const win = window as unknown as { goTo: (n: number) => void }
        win.goTo(n)
      }, i)
      await page.waitForTimeout(300)

      const wrapper = await page.$('.carousel-wrapper')
      if (!wrapper) throw new Error('Carousel wrapper element not found')

      const screenshot = await page.screenshot({
        clip: {
          x: 0,
          y: 0,
          width: SLIDE_SIZE,
          height: SLIDE_SIZE,
        },
        type: 'png',
      })

      pngBuffers.push(Buffer.from(screenshot))
    }

    return pngBuffers
  } finally {
    await browser.close()
  }
}

/**
 * Combine PNG buffers into a multi-page PDF (one slide per page).
 * Each page is 1080x1080 points. LinkedIn accepts PDF carousel uploads.
 */
export async function combineSlidesToPDF(pngBuffers: Buffer[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  for (const pngBuf of pngBuffers) {
    let image: PDFImage
    try {
      image = await pdfDoc.embedPng(pngBuf)
    } catch {
      image = await pdfDoc.embedJpg(pngBuf)
    }

    const page = pdfDoc.addPage([SLIDE_SIZE, SLIDE_SIZE])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: SLIDE_SIZE,
      height: SLIDE_SIZE,
    })
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Full render pipeline: slides JSON -> PNG buffers + PDF buffer.
 */
export async function renderCarousel(slides: CarouselSlide[]): Promise<{
  pngBuffers: Buffer[]
  pdfBuffer: Buffer
}> {
  const pngBuffers = await renderCarouselSlides(slides)
  const pdfBuffer = await combineSlidesToPDF(pngBuffers)
  return { pngBuffers, pdfBuffer }
}
