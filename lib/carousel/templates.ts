/**
 * HTML template engine for LinkedIn carousel slides.
 * Follows the design system in docs/carousel-design-system.md:
 * - 1080x1080 square slides, black bg, purple (#7B2FFF) accents
 * - Bebas Neue (display) + Inter (body) fonts
 * - AT logo watermark, corner accent triangle, slide counter
 */

import type { CarouselSlide } from '@/lib/social-content'
import { getLogoBase64, getProfilePhotoBase64 } from './assets'

const COLORS = {
  black: '#0a0a0a',
  purple: '#7B2FFF',
  purpleBright: '#9B5FFF',
  white: '#FFFFFF',
  gray: '#888888',
  darkText: '#BBBBBB',
}

function slideCounter(current: number, total: number): string {
  if (current === 0) return ''
  const num = String(current + 1).padStart(2, '0')
  const tot = String(total).padStart(2, '0')
  return `<div style="position:absolute;top:20px;left:22px;font-size:11px;font-weight:700;letter-spacing:2px;color:#444;text-transform:uppercase;font-family:'Inter',sans-serif;">${num} / ${tot}</div>`
}

function commonElements(logoB64: string): string {
  return `
    <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${COLORS.purple};"></div>
    <div style="position:absolute;bottom:0;right:0;width:140px;height:140px;background:${COLORS.purple};opacity:0.07;clip-path:polygon(100% 0,100% 100%,0 100%);"></div>
    <img src="data:image/png;base64,${logoB64}" style="position:absolute;bottom:14px;right:16px;width:44px;height:44px;opacity:0.85;" />
  `
}

function renderCover(slide: CarouselSlide, logoB64: string): string {
  return `
    <div style="position:relative;width:1080px;height:1080px;background:${COLORS.black};overflow:hidden;font-family:'Inter',sans-serif;">
      ${commonElements(logoB64)}
      ${slide.ghost_text ? `<div style="position:absolute;bottom:-40px;right:-20px;font-family:'Bebas Neue',sans-serif;font-size:280px;color:#1a1a1a;line-height:0.85;white-space:nowrap;">${slide.ghost_text}</div>` : ''}
      <div style="position:absolute;top:200px;left:60px;max-width:700px;">
        ${slide.eyebrow ? `<div style="font-size:14px;font-weight:700;letter-spacing:3px;color:${COLORS.purple};text-transform:uppercase;margin-bottom:20px;">${slide.eyebrow}</div>` : ''}
        <div style="font-family:'Bebas Neue',sans-serif;font-size:90px;color:${COLORS.white};line-height:1.0;margin-bottom:24px;">${slide.headline}</div>
        ${slide.subhead ? `<div style="font-size:18px;color:#aaa;max-width:500px;line-height:1.5;margin-bottom:30px;">${slide.subhead}</div>` : ''}
        ${slide.byline ? `<div style="font-size:13px;font-weight:700;letter-spacing:1px;color:${COLORS.gray};text-transform:uppercase;">${slide.byline}</div>` : ''}
      </div>
    </div>
  `
}

function renderHook(slide: CarouselSlide, index: number, total: number, logoB64: string): string {
  return `
    <div style="position:relative;width:1080px;height:1080px;background:${COLORS.black};overflow:hidden;font-family:'Inter',sans-serif;">
      ${commonElements(logoB64)}
      ${slideCounter(index, total)}
      <div style="position:absolute;top:220px;left:60px;max-width:900px;">
        ${slide.big_stat ? `<div style="font-family:'Bebas Neue',sans-serif;font-size:140px;color:${COLORS.purple};line-height:1.0;margin-bottom:10px;">${slide.big_stat}</div>` : ''}
        ${slide.stat_label ? `<div style="font-family:'Inter',sans-serif;font-size:28px;font-weight:900;color:${COLORS.white};text-transform:uppercase;margin-bottom:30px;">${slide.stat_label}</div>` : ''}
        ${slide.body ? `<div style="font-size:20px;color:${COLORS.darkText};line-height:1.65;max-width:700px;">${slide.body}</div>` : ''}
      </div>
    </div>
  `
}

function renderPrinciple(slide: CarouselSlide, index: number, total: number, logoB64: string): string {
  let headlineHtml = slide.headline
  if (slide.accent_word) {
    headlineHtml = slide.headline.replace(
      new RegExp(`(${slide.accent_word})`, 'i'),
      `<span style="color:${COLORS.purple};">$1</span>`
    )
  }

  return `
    <div style="position:relative;width:1080px;height:1080px;background:${COLORS.black};overflow:hidden;font-family:'Inter',sans-serif;">
      ${commonElements(logoB64)}
      ${slideCounter(index, total)}
      ${slide.number != null ? `<div style="position:absolute;top:40px;right:50px;font-family:'Bebas Neue',sans-serif;font-size:160px;color:rgba(255,255,255,0.12);line-height:1;">${String(slide.number).padStart(2, '0')}</div>` : ''}
      <div style="position:absolute;top:220px;left:60px;max-width:800px;">
        ${slide.pill ? `<div style="display:inline-block;background:${COLORS.purple};color:${COLORS.white};font-size:12px;font-weight:800;letter-spacing:2.5px;text-transform:uppercase;padding:8px 18px;border-radius:4px;margin-bottom:24px;">${slide.pill}</div>` : ''}
        <div style="width:48px;height:3px;background:${COLORS.purple};margin-bottom:24px;"></div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:64px;color:${COLORS.white};line-height:1.05;margin-bottom:28px;">${headlineHtml}</div>
        ${slide.body ? `<div style="font-size:18px;color:${COLORS.darkText};line-height:1.7;max-width:650px;">${slide.body}</div>` : ''}
      </div>
    </div>
  `
}

function renderQuote(slide: CarouselSlide, index: number, total: number, logoB64: string): string {
  return `
    <div style="position:relative;width:1080px;height:1080px;background:${COLORS.black};overflow:hidden;font-family:'Inter',sans-serif;">
      ${commonElements(logoB64)}
      ${slideCounter(index, total)}
      <div style="position:absolute;top:180px;left:60px;max-width:900px;">
        <div style="font-family:'Bebas Neue',sans-serif;font-size:200px;color:${COLORS.purple};line-height:0.7;margin-bottom:30px;">&ldquo;</div>
        ${slide.blockquote ? `<div style="font-family:'Inter',sans-serif;font-size:32px;font-weight:800;color:${COLORS.white};line-height:1.3;max-width:700px;margin-bottom:30px;">${slide.blockquote}</div>` : ''}
        ${slide.attribution ? `<div style="font-size:14px;font-weight:700;letter-spacing:2px;color:${COLORS.gray};text-transform:uppercase;">${slide.attribution}</div>` : ''}
      </div>
    </div>
  `
}

function renderCta(slide: CarouselSlide, index: number, total: number, logoB64: string, photoB64: string): string {
  const hashtagsHtml = slide.hashtags?.map(h => h.startsWith('#') ? h : `#${h}`).join('  ') || ''

  return `
    <div style="position:relative;width:1080px;height:1080px;background:${COLORS.black};overflow:hidden;font-family:'Inter',sans-serif;">
      ${commonElements(logoB64)}
      ${slideCounter(index, total)}
      <div style="position:absolute;top:180px;left:60px;max-width:800px;">
        ${slide.cta_label ? `<div style="font-size:14px;font-weight:700;letter-spacing:3px;color:${COLORS.purple};text-transform:uppercase;margin-bottom:20px;">${slide.cta_label}</div>` : ''}
        <div style="font-family:'Bebas Neue',sans-serif;font-size:64px;color:${COLORS.white};line-height:1.05;margin-bottom:24px;">${slide.headline}</div>
        ${slide.body ? `<div style="font-size:18px;color:${COLORS.darkText};line-height:1.65;max-width:600px;margin-bottom:20px;">${slide.body}</div>` : ''}
        ${hashtagsHtml ? `<div style="font-size:13px;font-weight:600;color:#555;margin-bottom:40px;">${hashtagsHtml}</div>` : ''}
      </div>
      <div style="position:absolute;bottom:60px;left:60px;right:60px;border-top:1px solid #222;padding-top:28px;display:flex;align-items:center;gap:16px;">
        <div style="width:56px;height:56px;border-radius:50%;overflow:hidden;border:2px solid ${COLORS.purple};flex-shrink:0;">
          <img src="data:image/jpeg;base64,${photoB64}" style="width:100%;height:100%;object-fit:cover;object-position:center top;" />
        </div>
        <div>
          <div style="font-size:14px;font-weight:800;color:${COLORS.white};text-transform:uppercase;letter-spacing:1px;">Vambah Sillah</div>
          <div style="font-size:12px;color:${COLORS.gray};margin-top:2px;">Director of Product · Co-Founder, Amadutown Advisory Solutions</div>
        </div>
      </div>
    </div>
  `
}

export function generateCarouselHTML(slides: CarouselSlide[]): string {
  const logoB64 = getLogoBase64()
  const photoB64 = getProfilePhotoBase64()
  const total = slides.length

  const slideRenderers: Record<string, (s: CarouselSlide, i: number) => string> = {
    cover: (s) => renderCover(s, logoB64),
    hook: (s, i) => renderHook(s, i, total, logoB64),
    principle: (s, i) => renderPrinciple(s, i, total, logoB64),
    quote: (s, i) => renderQuote(s, i, total, logoB64),
    cta: (s, i) => renderCta(s, i, total, logoB64, photoB64),
  }

  const slidesHtml = slides.map((slide, i) => {
    const renderer = slideRenderers[slide.type]
    if (!renderer) return renderPrinciple(slide, i, total, logoB64)
    return renderer(slide, i)
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; }
    .carousel-wrapper { display: flex; width: ${slides.length * 1080}px; overflow: hidden; }
    .carousel-wrapper > div { flex-shrink: 0; }
  </style>
</head>
<body>
  <div class="carousel-wrapper" id="slides">
    ${slidesHtml}
  </div>
  <script>
    let current = 0;
    const total = ${slides.length};
    function goTo(n) {
      current = Math.max(0, Math.min(total - 1, n));
      document.getElementById('slides').style.transform = 'translateX(-' + (current * 1080) + 'px)';
    }
    function nextSlide() { goTo(current + 1); }
    function prevSlide() { goTo(current - 1); }
  </script>
</body>
</html>`
}
