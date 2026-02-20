# Homepage Mission Cards — Visual, Animated (Revised)

**Status:** Plan only — not yet implemented.

## Goal

Add three **visual cards** under the Hero tagline that communicate Amadou Town’s model in minimal words: one short line per card, an **illustration** per card, and **scroll/parallax animation** (e.g. cards fan out as you scroll). No long paragraphs.

---

## Placement

- **Inside the Hero** section, directly **underneath the current tagline**.
- Order: Badge → Headline → Tagline → **Mission cards row** → CTAs → Brand visual (shield).
- Cards live in the same Hero content block so they benefit from existing Hero parallax (and can have their own scroll-based fan-out).

---

## Content (three cards, one short line each)

| Card | Short line (example) | Illustration theme |
|------|-----------------------|--------------------|
| **1. Community** | Free or at-cost for nonprofits—we give back. | Community / hands / heart / people (nonprofit, giving). |
| **2. Funding** | Mid-size and larger organizations help make it possible. | Partnership / handshake / building / growth. |
| **3. Dogfooding** | We use our own tools; improvements flow to everyone. | Cycle / refresh / tools / feedback loop. |

Copy is one sentence per card; illustration reflects that idea. Exact wording can be tightened in implementation.

---

## Design and behavior

1. **Layout**
   - One row of three cards (horizontal on desktop; can stack or stay row on mobile with smaller cards).
   - Each card: **image/illustration** on top (or left), **one short line** of text below (or beside). Glass-card or bordered style to match Hero (e.g. `glass-card`, `border-radiant-gold/20`).

2. **Animation**
   - **Scroll-based fan-out:** As the user scrolls down (or as the Hero enters/exits view), the three cards animate from a tighter formation (e.g. slightly overlapped or neutral) into a “fanned” layout (e.g. subtle rotate + translate so they spread out). Use Framer Motion `useScroll`, `useTransform`, and the Hero’s `containerRef` (or a small scroll window) to drive progress.
   - **Parallax:** Optional: cards or their backgrounds move at different speeds (e.g. `y` or `x` tied to `scrollYProgress`) for depth.
   - **Stagger:** If cards animate in, stagger their appearance (e.g. 0.1s delay between each).

3. **Illustrations**
   - Each card needs an **image** that reflects the message (community, partnership, dogfooding/cycle).
   - Options: (a) Add 3 assets under `public/` (e.g. `mission-community.png`, `mission-partners.png`, `mission-tools.png`) and use `<img>` or Next `Image`; (b) Use inline SVG illustrations (custom or from a set) for a consistent look; (c) Placeholder images first, replace with final art later.
   - Recommend: consistent aspect ratio (e.g. 4:3 or 1:1) and style (all illustration or all photo) so the row looks cohesive.

---

## Technical approach

- **Where:** [components/Hero.tsx](components/Hero.tsx). Add the cards block between the tagline `<motion.p>` and the CTAs `<motion.div>` (so after tagline, before “GET STARTED”).
- **Scroll/parallax:** Hero already uses `useScroll({ target: containerRef })` and `useTransform(scrollYProgress, ...)`. Add new `useTransform` mappings for:
  - Fan-out: e.g. translate/rotate each card based on `scrollYProgress` (e.g. 0 → 0.15 so the effect happens early in the scroll).
  - Optional parallax: different `y` or `x` per card from `scrollYProgress`.
- **Cards:** Three `<motion.div>` (or one wrapper with three children). Each: image container + one line of text. Use `style={{ y, rotate, ... }}` or `animate`/`whileInView` for fan-out and stagger.
- **Assets:** Either reference new files in `public/` or implement with SVG/placeholder; document required image specs (size, style) for final art.

---

## Files to change

| File | Change |
|------|--------|
| [components/Hero.tsx](components/Hero.tsx) | Insert mission cards block below tagline; add scroll-based fan-out (and optional parallax); one short line + image per card. |
| `public/` (optional) | Add 3 illustration assets for the cards, or use placeholders/SVG. |

No new top-level section, no nav item, no separate Mission page—everything stays inside Hero with minimal copy and strong visual + motion.

---

## Implementation addendum (design-system–aligned spec)

*Append this section when implementing the mission cards so they match the homepage design language.*

### 1. Design system alignment

**Colors (use these tokens only):**
- **Background / container:** Same as Hero content — no extra wrapper background; cards sit on `bg-imperial-navy` (inherited).
- **Card surface:** `glass-card` (from `globals.css`: `rgba(44,62,80,0.4)`, `backdrop-blur(12px)`, border `rgba(212,175,55,0.2)`). Override border for emphasis with `border-radiant-gold/20` or `border-radiant-gold/30`.
- **Text:** One-line copy → `text-platinum-white/80` or `text-platinum-white/70` for body; optional small label above → `text-radiant-gold` + `font-heading` (e.g. Community, Funding, Dogfooding).
- **Accents:** `radiant-gold` for borders and highlights; `silicon-slate` only in existing patterns (e.g. pill-badge); avoid introducing new colors.

**Typography:**
- **Card one-liner:** `font-body text-sm sm:text-base text-platinum-white/80 leading-snug`. Max one line on desktop; allow two lines on small screens if needed (`line-clamp-2` only if design allows).
- **Optional card label (e.g. “Community”):** `text-[10px] font-heading uppercase tracking-[0.2em] text-radiant-gold` — same as Hero badge and About section labels.
- **Do not use** `font-premium` for the mission card copy (reserved for headlines); keep body copy in `font-body`.

**Spacing:**
- **Block placement:** Insert mission cards **between** the tagline `<motion.p>` and the CTAs `<motion.div>`. Use `mb-8` or `mb-10` on the tagline and `mb-10` or `mb-12` on the mission cards wrapper so the gap to CTAs matches existing `mb-16` rhythm.
- **Content width:** Reuse Hero content width: `max-w-5xl mx-auto px-6` (already on parent). Cards container: `w-full` inside that.
- **Card spacing:** `gap-6` (mobile) and `gap-8` (md+) so the row doesn’t feel cramped; section spacing elsewhere uses `py-32`, `gap-10` in About/Services — mission cards are denser, so `gap-6 sm:gap-8` is enough.

**Motion patterns (existing in Hero):**
- Hero uses `useScroll({ target: containerRef, offset: ["start start", "end start"] })` and `useTransform(scrollYProgress, inputRange, outputRange)` for `y`, `opacity`, `scale`. Reuse the same `scrollYProgress` (and optionally `containerRef`) for mission card motion.
- Existing Framer usage: `initial` / `animate` / `transition` for entrance; `style={{ y, opacity, scale }}` for scroll-driven values. Use the same style of `useTransform` for fan-out/parallax (see §3).
- Stagger: elsewhere (About, Services, Store) use `delay: index * 0.08` or `0.1` with `duration: 0.6`. Use the same for card entrance (e.g. `transition={{ duration: 0.6, delay: index * 0.1 }}`).

---

### 2. Card structure and layout

**Wrapper (one row of three cards):**
- **Desktop (md and up):** `flex` or `grid grid-cols-3` with `gap-6 sm:gap-8`, `items-stretch`, `justify-center`.
- **Mobile:** Stack vertically: `flex flex-col sm:flex-row` or `grid grid-cols-1 sm:grid-cols-3` so that below `sm` cards stack. Prefer `grid grid-cols-1 md:grid-cols-3` so one column on small, three on medium+ (matches Services/Store breakpoint logic).
- **Container:** `<motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-4xl mx-auto">` so cards don’t exceed the Hero content width and stay centered.

**Single card:**
- **Root:** `<motion.div className="glass-card border border-radiant-gold/20 rounded-2xl overflow-hidden ...">` — reuse `glass-card`, explicit `border-radiant-gold/20`, `rounded-2xl` to align with Services/Store cards. No pill-badge inside unless you add a small label; then use the same pill style as Hero/About.
- **Layout inside card:** Illustration on **top**, one line of copy **below** (stack). Structure:
  - **Image container:** `relative aspect-[4/3] sm:aspect-[4/3] w-full overflow-hidden` (consistent 4:3 so all three cards match). Use `object-cover` on `<img>` or Next `Image`.
  - **Copy block:** `p-4 sm:p-5` with one `<p>` for the one-liner. Optional small label above: same style as Hero badge text (`text-[10px] font-heading uppercase tracking-[0.2em] text-radiant-gold`).
- **Dimensions:** Do not set a fixed height; let content define it. Min height for touch: ensure the card (or its primary tap area) is at least ~44px tall on mobile; the illustration + padding + one line will exceed that.
- **Reuse:** Same card pattern as Store/Services: image area on top, content below, rounded-2xl, border from design tokens. Do not introduce a new “card” class; use `glass-card` + Tailwind.

**Image/illustration:**
- **Aspect ratio:** 4:3 for all three (e.g. `aspect-[4/3]` on the wrapper).
- **Assets:** `public/mission-community.png`, `public/mission-partners.png`, `public/mission-tools.png` (or equivalent names). Use `<img>` or Next.js `Image` with `alt` descriptive of the card’s message (see §4).
- **Fallback:** If no asset, use a neutral placeholder (e.g. `bg-imperial-navy` + Lucide icon in `text-radiant-gold/30`) so layout and spacing stay correct.

---

### 3. Animation specifics

**Scroll-driven values (reuse Hero’s `scrollYProgress`):**
- **Fan-out (translate + optional rotate):**  
  - Left card: `useTransform(scrollYProgress, [0, 0.12], [0, -12])` → apply to `y` (or combine with a slight `x`: `[0, -8]` so it moves up-and-left).  
  - Center: `useTransform(scrollYProgress, [0, 0.12], [0, -20])` → `y` only (stronger parallax).  
  - Right card: `useTransform(scrollYProgress, [0, 0.12], [0, -12])` with `x` positive (e.g. `[0, 8]`) so it moves up-and-right.  
  Input range `[0, 0.12]` keeps the effect in the first ~12% of scroll; adjust if the Hero content is short so the effect is visible.
- **Optional rotation (subtle):** e.g. `useTransform(scrollYProgress, [0, 0.12], [-2, 0])` for left card (start slightly rotated left, go to 0); right card `[2, 0]`. Use `rotate` in `style` (e.g. `style={{ y, rotate }}`). Prefer small values (2–3deg) so it doesn’t distract.
- **Optional parallax (depth):** Different `y` per card already gives depth. If you want more: give each card a different `useTransform(scrollYProgress, [0, 0.15], [0, -15])`, `[0, -25]`, `[0, -18]` so they move at slightly different speeds.

**Stagger:**
- **Entrance (when in view or on load):** Use `initial={{ opacity: 0, y: 16 }}`, `animate={{ opacity: 1, y: 0 }}` (or `whileInView={{ opacity: 1, y: 0 }}` with `viewport={{ once: true }}`), and `transition={{ duration: 0.6, delay: index * 0.1 }}` so cards appear in order (0, 0.1, 0.2 s delay).
- **Scroll-based motion:** Apply the same `useTransform`-derived `y` (and optional `rotate`) to each card’s `style`. No stagger needed for scroll — all three react to the same `scrollYProgress`.

**Accessibility (motion):**
- **prefers-reduced-motion:** Check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` (or a hook), or use Framer’s `useReducedMotion()`. When reduced motion is preferred: do not apply scroll-based `y`/`rotate`/parallax; set `style={{}}` or static values so cards stay in place. Still allow entrance animation with a very short duration (e.g. `duration: 0.2`) or skip it (opacity only, no `y`).
- **Implementation:** e.g. `const reduceMotion = useReducedMotion();` then `style={ reduceMotion ? {} : { y, rotate } }` and for entrance use `transition={{ duration: reduceMotion ? 0.2 : 0.6, delay: reduceMotion ? 0 : index * 0.1 }}`.

---

### 4. Accessibility and responsiveness

- **Focus order:** Mission cards block sits after tagline and before CTAs. If cards are not interactive (no links/buttons), no tab stop is required; if you add links (e.g. “Learn more”), ensure focus order is: Badge → Headline → Tagline → Card 1 → Card 2 → Card 3 → GET STARTED → VIEW PRICING → EXPLORE WORK.
- **Alt text:** Use descriptive alt for each illustration, e.g. “Illustration: community and giving back to nonprofits”, “Illustration: partnership and growth with organizations”, “Illustration: feedback loop of using our own tools”. Avoid “Community card image”; describe the concept.
- **Contrast:** One-line copy uses `text-platinum-white/80` on `imperial-navy`-like glass; that meets WCAG AA for body text. If in doubt, use `text-platinum-white` (no opacity) for the sentence.
- **Responsive behavior:**  
  - **Breakpoints:** Stack at default (`grid-cols-1`), three columns from `md:grid-cols-3`. Use `sm:gap-8` so spacing is slightly larger on larger phones.  
  - **Overflow:** Card content (one line) should not overflow; use `line-clamp-2` only if design allows two lines on narrow widths. Image is `object-cover` inside `aspect-[4/3]` so it never overflows.  
  - **Touch targets:** If the whole card becomes clickable later, ensure min ~44px height for the interactive area; current layout (image + padding + text) already exceeds that.

---

### 5. Code snippets (Tailwind + Framer Motion)

**Mission cards wrapper (insert between tagline and CTAs):**
```tsx
{/* Mission cards — scroll fan-out + optional parallax */}
<motion.div
  className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 w-full max-w-4xl mx-auto mb-10 sm:mb-12"
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } },
    hidden: {},
  }}
>
  {[
    { id: 'community', label: 'Community', line: 'Free or at-cost for nonprofits—we give back.', img: '/mission-community.png', alt: 'Illustration: community and giving back to nonprofits.' },
    { id: 'funding', label: 'Funding', line: 'Mid-size and larger organizations help make it possible.', img: '/mission-partners.png', alt: 'Illustration: partnership and growth with organizations.' },
    { id: 'dogfooding', label: 'Dogfooding', line: 'We use our own tools; improvements flow to everyone.', img: '/mission-tools.png', alt: 'Illustration: feedback loop of using our own tools.' },
  ].map((card, index) => (
    <MissionCard key={card.id} index={index} {...card} scrollYProgress={scrollYProgress} reduceMotion={reduceMotion} />
  ))}
</motion.div>
```

**Single card component (conceptual):**
- Use `useTransform(scrollYProgress, [0, 0.12], [0, index === 0 ? -12 : index === 1 ? -20 : -12])` for `y` (and optional `x`/`rotate` as in §3).
- Apply `style={{ y: reduceMotion ? undefined : y, rotate: reduceMotion ? undefined : rotate }}` on the card `motion.div`.
- Card classes: `glass-card border border-radiant-gold/20 rounded-2xl overflow-hidden`; image wrapper `aspect-[4/3]`; text `p-4 sm:p-5` with `font-body text-sm sm:text-base text-platinum-white/80`.

**Reduced motion hook (if not already in project):**
```ts
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';
// use: const reduceMotion = useFramerReducedMotion() ?? false;
```

---

## Out of scope (this revision)

- Long-form “Mission” or “Our Model” section below Hero.
- New section in Navigation or in `app/page.tsx` sections array.
- Changes to About, Store, or Services.
