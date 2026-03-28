# LinkedIn Carousel Design System — Amadutown Advisory Solutions

Use this document to generate LinkedIn carousel slides that match the established ATAS visual identity. All carousels are built as HTML/CSS with Playwright rendering to PNG or PDF for upload.

---

## Design Language

**Aesthetic:** Bold editorial. High contrast. Authoritative but accessible. Think premium streetwear brand meets enterprise consulting.

**NOT:** Generic blue corporate. Gradient-heavy SaaS. Cluttered. Soft.

---

## Color System

```css
--black:         #0a0a0a;   /* Slide backgrounds */
--purple:        #7B2FFF;   /* Primary accent — headers, pills, bars, CTAs */
--purple-bright: #9B5FFF;   /* Hover states only */
--white:         #FFFFFF;   /* Primary text */
--gray:          #888888;   /* Secondary text, metadata */
--dark-text:     #BBBBBB;   /* Body copy on dark backgrounds */
```

---

## Typography

```css
/* Display / Headlines */
font-family: 'Bebas Neue', sans-serif;
/* Use for: Slide headlines, large numbers, pull quotes, cover titles */

/* Body / UI */
font-family: 'Inter', sans-serif;
/* Use for: Body copy, pills, labels, bylines, metadata */
```

Import via Google Fonts:
```
https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700;900&display=swap
```

---

## Slide Dimensions

```
Width:  540px (preview) → scales to 1080px for export
Height: 540px (preview) → scales to 1080px for export
Aspect ratio: 1:1 (square — LinkedIn carousel standard)
```

For high-res export, double all pixel values or set Playwright viewport to 1080x1080.

---

## Structural Elements (Applied to Every Slide)

### Top accent bar
```css
.slide::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: #7B2FFF;
}
```

### AT Logo (bottom-right, every slide)
- Position: `bottom: 14px; right: 16px`
- Size: 44px × 44px
- Opacity: 0.85
- Use the Amadutown shield logo (ATlogo_Transparent.png)
- Embed as base64 in HTML for self-contained files

### Corner accent
```css
.accent-bar {
  position: absolute;
  bottom: 0; right: 0;
  width: 140px; height: 140px;
  background: #7B2FFF;
  opacity: 0.07;
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
```

### Slide counter badge (top-left, slides 2+)
```css
.slide-counter-badge {
  position: absolute;
  top: 20px; left: 22px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #444;
  text-transform: uppercase;
}
```
Format: `02 / 11`

---

## Slide Templates

### Template 1: Cover Slide (Slide 1)

Layout: Full bleed, content centered-left, large ghost element background right.

```
[EYEBROW — purple, 11px, uppercase, letter-spacing 3px]
[HEADLINE — Bebas Neue, 72px, white, max-width 380px]
[SUBHEAD — 14px, #aaa, max-width 300px]
[BYLINE — 11px, uppercase, gray]
[Ghost background element — large Bebas Neue text or symbol, #1a1a1a, bottom-right]
[Purple top bar]
[AT Logo bottom-right]
[Corner accent]
```

### Template 2: Hook / Context Slide

Layout: Big stat or number as hero, explanation below.

```
[Slide counter — top-left]
[BIG STAT — Bebas Neue, 100px, purple]
[STAT LABEL — Inter 900, 22px, white, uppercase]
[Body copy — 16px, #bbb, line-height 1.65, max-width 420px]
[Purple top bar]
[AT Logo]
[Corner accent]
```

### Template 3: Principle Slide (main content workhorse)

Layout: Number ghost top-right, pill label, divider, headline, body.

```
[Slide counter — top-left]
[Ghost number — Bebas Neue, 120px, rgba(255,255,255,0.12), top-right]
[PILL — purple background, white text, 10px, 800 weight, uppercase, letter-spacing 2.5px]
[Purple divider — 48px wide, 3px tall]
[HEADLINE — Bebas Neue, 52px, white, accent word in purple]
[Body copy — 14px, #bbb, line-height 1.7, max-width 420px]
[Purple top bar]
[AT Logo]
[Corner accent]
```

Pill examples: `API Security` / `Environments` / `AI Quality` / `Access Control` / `Model Strategy`

### Template 4: Pull Quote / Thesis Slide

Layout: Large quotation mark hero, blockquote, attribution.

```
[Slide counter — top-left]
[Giant " — Bebas Neue, 160px, purple, line-height 0.7]
[BLOCKQUOTE — Inter 800, 26px, white, line-height 1.3, max-width 400px, key phrase in purple]
[Attribution — 12px, gray, uppercase, letter-spacing 2px]
[Purple top bar]
[AT Logo]
[Corner accent]
```

### Template 5: Closing / CTA Slide

Layout: Top content block + bottom profile row separated by border.

```
[Slide counter — top-left]
[CTA LABEL — purple, 11px, uppercase, letter-spacing 3px]
[HEADLINE — Bebas Neue, 52px, white, key phrase in purple]
[CTA body — 14px, #bbb, line-height 1.65, max-width 380px]
[Hashtags — 11px, #555, font-weight 600]
[Divider — 1px solid #222]
[PROFILE ROW:]
  [Avatar — 56px circle, overflow hidden, border 2px solid purple]
    [Profile photo — object-fit cover, object-position center top]
  [Name — Inter 800, 13px, white, uppercase, letter-spacing 1px]
  [Title — 11px, gray]
[Purple top bar]
[AT Logo]
[Corner accent]
```

Profile photo: Use `Profile_Photo.jpg` (Vambah in light blue shirt, smiling).
Name: Vambah Sillah
Title: Director of Product · Co-Founder, Amadutown Advisory Solutions

---

## CSS Variables Reference

```css
:root {
  --black: #0a0a0a;
  --purple: #7B2FFF;
  --purple-bright: #9B5FFF;
  --white: #FFFFFF;
  --gray: #888888;
}
```

---

## Standard Carousel Structure

For a 7-principle carousel (most common format):

| Slide | Template | Purpose |
|-------|----------|---------|
| 1 | Cover | Title + author + topic framing |
| 2 | Hook | Macro context / provocative stat |
| 3–N | Principle | One insight per slide, numbered |
| N+1 | Pull Quote | Core thesis distilled |
| N+2 | Closing | CTA + question + profile row |

---

## Rendering & Export

Use Playwright (Python) to render HTML to PNG:

```python
import asyncio
from playwright.async_api import async_playwright

async def render_slides(html_path, output_dir, total_slides):
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 540, "height": 540})
        await page.goto(f"file://{html_path}")
        await page.wait_for_load_state("networkidle")
        await asyncio.sleep(1)

        for i in range(total_slides):
            await page.evaluate(f"goTo({i})")
            await asyncio.sleep(0.3)
            el = await page.query_selector(".carousel-wrapper")
            screenshot = await el.screenshot(type="png")
            with open(f"{output_dir}/slide_{i+1:02d}.png", "wb") as f:
                f.write(screenshot)

        await browser.close()

asyncio.run(render_slides("/path/to/carousel.html", "./slides", 11))
```

For PDF (LinkedIn native carousel format):
```python
from PIL import Image

images = [Image.open(f"slides/slide_{i:02d}.png").convert("RGB") for i in range(1, total+1)]
images[0].save("carousel.pdf", save_all=True, append_images=images[1:], resolution=150)
```

---

## JavaScript Navigation (required in HTML)

Every carousel HTML file must include this JS for Playwright to navigate slides:

```javascript
let current = 0;
const total = SLIDE_COUNT; // replace with actual count

function goTo(n) {
  current = Math.max(0, Math.min(total - 1, n));
  document.getElementById('slides').style.transform = `translateX(-${current * 540}px)`;
  // update dots and counter if present
}

function nextSlide() { goTo(current + 1); }
function prevSlide() { goTo(current - 1); }
```

---

## Assets

| Asset | File | Usage |
|-------|------|-------|
| AT Shield Logo | `ATlogo_Transparent.png` | Bottom-right every slide, 44px, opacity 0.85 |
| Profile Photo | `Profile_Photo.jpg` | Closing slide avatar, circle crop, top-center |

Embed both as base64 in the HTML file for portability:
```python
import base64
with open("ATlogo_Transparent.png", "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode()
# Use as: src="data:image/png;base64,{logo_b64}"
```

---

## Quality Checklist

Before exporting:
- [ ] Purple top bar on every slide
- [ ] AT Logo bottom-right, opacity 0.85, every slide
- [ ] Corner accent triangle every slide
- [ ] Ghost numbers use `rgba(255,255,255,0.12)` — NOT `#1c1c1c`
- [ ] Slide counter format: `02 / 11`
- [ ] Profile photo in closing slide circle, not initials placeholder
- [ ] Hashtags in closing slide footer
- [ ] All slides same dimensions (540×540 or 1080×1080)
- [ ] Bebas Neue loaded for all display text
