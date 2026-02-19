# AmaduTown design standard – color palette audit

**Scope:** This audit identifies every place in the codebase where UI colors deviate from the **AmaduTown** design standard so that those areas can be redesigned to use the same color palette.

**Canonical source of truth:** `app/globals.css` and `tailwind.config.ts` (navy/gold palette).

---

## 1. Summary table

| Area / Route or component | Deviation type | Files and line references | Priority |
|---------------------------|---------------|----------------------------|----------|
| Store product detail | Gray-based UI, Cyan/blue accents, Cyan–blue gradient CTA | `app/store/[id]/page.tsx` (gray-*, cyan-*, from-cyan-600 to-blue-600) | High |
| Store listing | Gray, blue–purple gradient CTA | `app/store/page.tsx` (gray-400, from-blue-600 to-purple-600) | High |
| Checkout | Gray-based UI, blue–purple gradients, purple hover, amber icon | `app/checkout/page.tsx` (gray-*, from-blue-600 to-purple-600, border-purple-500, amber-400) | High |
| Auth (login/signup) | Gray-based UI, purple focus, purple–pink gradient CTAs, purple links | `components/auth/LoginForm.tsx`, `SignupForm.tsx` (gray-*, focus:border-purple-500, from-purple-600 to-pink-600, text-purple-400) | High |
| Auth pages (suspense) | Gray loading text | `app/auth/login/page.tsx`, `app/auth/signup/page.tsx` (text-gray-400) | Low |
| Services (public) | Gray search icon, cyan–blue gradients | `app/services/page.tsx`, `app/services/[id]/page.tsx` (gray-400, from-cyan-*, to-blue-*) | Medium |
| Services component | Slate palette, cyan/amber category accents | `components/Services.tsx` (slate-*, cyan-500, amber-500) | Medium |
| Pricing (custom) | Blue-only gradient section | `app/pricing/custom/page.tsx` (from-blue-600 to-blue-800) | Medium |
| Lead magnets (public) | Gray text | `app/lead-magnets/page.tsx` (text-gray-400) | Low |
| Purchases | Blue–purple gradients, green semantic | `app/purchases/page.tsx` (from-blue-600 to-purple-600, green-* semantic) | Medium |
| Proposal | Green/orange/indigo type badges, green CTAs | `app/proposal/[id]/page.tsx` (green-*, orange-*, indigo-*) | Medium |
| Admin dashboard | Slate–indigo, sky–blue, violet–purple, cyan–blue, purple–pink gradients | `app/admin/page.tsx` (from-slate-*, from-sky-*, from-violet-*, from-cyan-*, from-purple-*) | High |
| Admin content – products | Gray UI, blue–purple gradients, purple/blue/cyan badges, purple focus | `app/admin/content/products/page.tsx`, `[id]/page.tsx` (gray-*, from-blue-600 to-purple-600, purple-*, blue-*, cyan-*, focus:border-purple-500) | High |
| Admin content – discount codes | Gray inputs, purple focus, blue–purple gradient CTAs, purple/green badges | `app/admin/content/discount-codes/page.tsx` | High |
| Admin content – merchandise | Gray inputs, purple focus/gradients, purple–blue card gradient | `app/admin/content/merchandise/page.tsx` | High |
| Admin content – services | Gray icons, blue–purple gradient CTAs | `app/admin/content/services/page.tsx` | Medium |
| Admin content – content hub | Blue/red/purple/teal/indigo gradient definitions | `app/admin/content/page.tsx` (from-*-500 to-*-500) | Medium |
| Admin content – videos | Red–pink gradient CTAs | `app/admin/content/videos/page.tsx` (from-red-600 to-pink-600) | Medium |
| Admin content – lead magnets, prototypes, music | Purple–pink gradients | Multiple files under `app/admin/content/` | Medium |
| Admin content – prototypes [id] | Gray + purple–pink gradient save | `app/admin/content/prototypes/[id]/page.tsx` | Medium |
| Admin discount-codes, merchandise | (see Admin content rows above) | — | — |
| Admin outreach | Blue–purple/orange–purple gradients, gray search | `app/admin/outreach/page.tsx`, `app/admin/outreach/dashboard/page.tsx` (from-orange-*, from-blue-*, from-purple-*, gray-500) | High |
| Admin value-evidence | Blue–cyan, purple–pink gradients/borders | `app/admin/value-evidence/page.tsx` | Medium |
| Admin sales – audit page | Gray, blue, purple, emerald, orange (mix semantic + accent) | `app/admin/sales/[auditId]/page.tsx` | High |
| Admin sales – bundles, scripts, upsell-paths, etc. | Gray icons/text, blue–purple or blue accents | Various under `app/admin/sales/` | Medium |
| Admin guarantees | Gray search, indigo info box, green CTA | `app/admin/guarantees/page.tsx`, `[instanceId]/page.tsx` | Medium |
| Admin client-projects | Gray, blue–cyan/blue–emerald/blue–indigo gradients | `app/admin/client-projects/page.tsx`, `[id]/page.tsx` | Medium |
| Admin analytics | Indigo–cyan gradient button | `app/admin/analytics/page.tsx` | Low |
| Admin meeting-tasks | Violet–purple icon gradient | `app/admin/meeting-tasks/page.tsx` | Low |
| Admin prompts | Blue–cyan, purple–pink gradient keys | `app/admin/prompts/page.tsx` | Low |
| Admin layout | Gray header border/text | `app/admin/layout.tsx` (border-gray-800, text-gray-400) | Medium |
| Admin users | Gray search icon | `app/admin/users/page.tsx` (text-gray-400) | Low |
| Download manager | Gray UI, purple/blue/cyan/amber accents, blue–purple gradient | `components/DownloadManager.tsx` | Medium |
| Product classifier (admin) | Light gray/white UI (full off-palette), blue/purple/emerald accents | `components/admin/sales/ProductClassifier.tsx` (gray-100, white, blue-600, purple-600, emerald-600) | High |
| Referral program | Gray inputs, purple/blue/green icons | `components/ReferralProgram.tsx` | Low |
| Proposal modal | Blue accent blocks and CTA | `components/admin/sales/ProposalModal.tsx` | Medium |
| Discount code form (checkout) | Gray icon, purple focus/hover, green success | `components/checkout/DiscountCodeForm.tsx` | Medium |
| Contact form (checkout) | Gray icons | `components/checkout/ContactForm.tsx` (text-gray-400) | Low |
| Order summary | Blue–green/purple–blue item gradients | `components/checkout/OrderSummary.tsx` | Low |
| Stripe/checkout CTAs | (see Checkout page) | — | — |
| Shopping cart | Blue–purple gradient CTA, blue–green/purple–blue item gradients | `components/ShoppingCart.tsx` | Medium |
| Product card | Purple–blue card gradient, blue–purple CTA, green price | `components/ProductCard.tsx` | Medium |
| Service card | Cyan–blue gradient, cyan–blue CTA | `components/ServiceCard.tsx` | Medium |
| Offer card (admin) | Blue–purple card gradient, green accents | `components/admin/sales/OfferCard.tsx` | Medium |
| Exit intent / time-based popups | Blue–purple gradient CTAs | `components/ExitIntentPopup.tsx`, `components/TimeBasedPopup.tsx`, `components/ScrollOffer.tsx` | Low |
| Animated scroll (resume) | Slate palette throughout | `components/ui/animated-scroll.tsx` (slate-300–950, emerald-500 dots) | High |
| Timeline | Slate palette, emerald accents | `components/ui/timeline.tsx` (slate-400–950, emerald-400/900) | High |
| Hero parallax | Slate background/text | `components/ui/hero-parallax.tsx` (bg-slate-950, text-slate-300) | Medium |
| Client dashboard components | Blue–indigo, purple–violet gradients | `components/client-dashboard/*.tsx` (DashboardStatCards, WorkshopCountdown, AccelerationCards, etc.) | Medium |
| Continuity lib | Cyan/green status badges | `lib/continuity.ts` (trialing: cyan-*, active: green-*) | Low (semantic) |
| Breadcrumbs | Gray text/chevron | `components/Breadcrumbs.tsx` (text-gray-400, text-gray-600) | Low |

---

## 2. Grouped by area

### Public – Store & commerce

- **`app/store/[id]/page.tsx`** — Product detail: gray backgrounds/borders/text (gray-400, gray-800, gray-900, etc.), cyan/blue hero gradient (from-cyan-900/20 to-blue-900/20), cyan badges and links (text-cyan-400, bg-cyan-500/90), primary CTA as cyan–blue gradient (from-cyan-600 to-blue-600). Whole page is off-palette.
- **`app/store/page.tsx`** — Store listing: gray-400 search icon, primary CTA as blue–purple gradient (from-blue-600 to-purple-600).
- **`app/checkout/page.tsx`** — Checkout: gray containers and text (gray-400, gray-800, gray-900), Lock icon amber-400, primary pay CTA blue–purple gradient, secondary CTA purple hover (hover:border-purple-500).
- **`app/checkout/payment/page.tsx`** — (Included in files list; same checkout flow.)
- **`app/purchases/page.tsx`** — Blue–purple gradient CTAs; green used for success/status (semantic).
- **`app/lead-magnets/page.tsx`** — Gray loading/empty text (text-gray-400).

### Public – Auth

- **`app/auth/login/page.tsx`** — Suspense fallback text-gray-400.
- **`app/auth/signup/page.tsx`** — Suspense fallback text-gray-400.
- **`components/auth/LoginForm.tsx`** — Gray labels/inputs/borders (gray-300, gray-400, gray-800, gray-900), purple focus (focus:border-purple-500), primary CTA gradient (from-purple-600 to-pink-600), links (text-purple-400).
- **`components/auth/SignupForm.tsx`** — Same pattern; success message uses green-500/20 (semantic).

### Public – Services & pricing

- **`app/services/page.tsx`** — Gray-400 search icon, cyan–blue gradient CTA (from-cyan-600 to-blue-600).
- **`app/services/[id]/page.tsx`** — Cyan–blue hero gradient and CTA; green for “Free” and checkmarks (semantic).
- **`components/Services.tsx`** — Slate borders/badges/icons (slate-400, slate-500), category filters: cyan (build), amber (advisory), slate (default).
- **`app/pricing/page.tsx`** — (Minimal deviation in snippet; may share pricing components.)
- **`app/pricing/custom/page.tsx`** — Full-width blue gradient section (from-blue-600 to-blue-800).

### Public – Proposals & onboarding

- **`app/proposal/[id]/page.tsx`** — Type badges: green (bonus), orange (downsell), indigo (continuity); green CTAs and success text.

### Shared – Checkout & cart components

- **`components/checkout/DiscountCodeForm.tsx`** — Gray-400 icon, focus:border-purple-500, hover:border-purple-500; green success box (semantic).
- **`components/checkout/ContactForm.tsx`** — Gray-400 icons.
- **`components/checkout/OrderSummary.tsx`** — Item thumbnails: from-blue-900/20 to-green-900/20 and from-purple-900/20 to-blue-900/20; green price text.
- **`components/ShoppingCart.tsx`** — Same thumbnail gradients; primary CTA from-blue-600 to-purple-600.
- **`components/ProductCard.tsx`** — Card hero from-purple-900/20 to-blue-900/20; CTA from-blue-600 to-purple-600; green for price/Free.
- **`components/ServiceCard.tsx`** — Card from-cyan-900/20 to-blue-900/20; CTA from-cyan-600 to-blue-600.
- **`components/DownloadManager.tsx`** — Gray cards/borders, purple hover/focus, blue–purple gradient for primary action, cyan/amber status-style buttons, blue/green icons.

### Shared – Auth & referral

- (Auth forms covered above.)
- **`components/ReferralProgram.tsx`** — Gray-800 inputs, purple/blue hover, purple/green icons.

### Shared – UI primitives & layout

- **`components/ui/animated-scroll.tsx`** — Entire resume/scroll experience: text-slate-300/400/500, border-slate-600/800, bg-slate-900/950, pagination dots bg-slate-700 / bg-emerald-500.
- **`components/ui/timeline.tsx`** — bg-slate-950, text-slate-400/500, border-slate-700/800, gradient via-slate-700, emerald-400/900 accents.
- **`components/ui/hero-parallax.tsx`** — bg-slate-950, text-slate-300.
- **`components/Breadcrumbs.tsx`** — text-gray-400, text-gray-600, hover:text-white.

### Admin – Dashboard & layout

- **`app/admin/page.tsx`** — All dashboard cards use non-brand gradients: slate–indigo, sky–blue, blue–cyan, violet–purple, cyan–blue, purple–pink. High visibility.
- **`app/admin/layout.tsx`** — Header border-gray-800, text-gray-400, hover:text-white.

### Admin – Content (products, discount codes, merchandise, services, videos, lead magnets, prototypes, music)

- **`app/admin/content/products/page.tsx`** — Gray copy and cards; blue–purple gradient “Add product”; purple/blue/cyan/green badges; blue hover on secondary button.
- **`app/admin/content/products/[id]/page.tsx`** — Gray form fields; purple focus; cyan/blue icons and hover (upload); blue–purple gradient submit.
- **`app/admin/content/discount-codes/page.tsx`** — Gray inputs, purple focus; blue–purple gradient CTAs; purple/green badges.
- **`app/admin/content/merchandise/page.tsx`** — Gray inputs, purple focus and gradients; card from-purple-900/20 to-blue-900/20; green success states.
- **`app/admin/content/services/page.tsx`** — Gray-400 icons; blue–purple gradient CTAs.
- **`app/admin/content/page.tsx`** — Gradient config keys: from-blue-500 to-cyan-500, from-red-500 to-pink-500, from-purple-500 to-pink-500, from-teal-500 to-cyan-500, from-indigo-500 to-purple-500.
- **`app/admin/content/videos/page.tsx`** — Red–pink gradient CTAs (from-red-600 to-pink-600).
- **`app/admin/content/lead-magnets/page.tsx`** — Purple–pink gradient CTAs.
- **`app/admin/content/prototypes/page.tsx`**, **`[id]/page.tsx`**, **`[id]/demos/page.tsx`** — Purple–pink gradients; [id] also gray-800/gray-500 for disabled save.
- **`app/admin/content/music/page.tsx`** — Purple–pink gradient CTAs.

### Admin – Sales (bundles, scripts, upsell-paths, conversation, audit, proposals)

- **`app/admin/sales/[auditId]/page.tsx`** — Gray labels; blue/purple/emerald/orange for sections, buttons, and semantic states (e.g. objections orange, positive green).
- **`app/admin/sales/bundles/page.tsx`** — Gray-500 search icon.
- **`app/admin/sales/upsell-paths/page.tsx`** — Gray-500 search.
- **`components/admin/sales/ProductClassifier.tsx`** — Light theme: white, gray-100/200/300/400/500/600/700/900; blue/purple/emerald for actions and icons. Completely off dark brand.
- **`components/admin/sales/ProposalModal.tsx`** — Blue-400/900 blocks and blue-600 CTA.
- **`components/admin/sales/OfferCard.tsx`** — Card bg gradient from-blue-600 to-purple-700; green for price/success.
- **`components/admin/sales/BundleEditor.tsx`** — Gray-500 icon.

### Admin – Outreach & value evidence

- **`app/admin/outreach/page.tsx`** — Title bg-gradient from-blue-400 to-purple-400; orange–purple and purple–blue gradient buttons; gray-500 search.
- **`app/admin/outreach/dashboard/page.tsx`** — Title gradient orange–green–blue; cold leads from-blue-600 to-cyan-500; orange–purple CTA; blue/purple card gradients.
- **`app/admin/value-evidence/page.tsx`** — Blue–cyan and purple–pink gradient cards/borders.

### Admin – Client projects, guarantees, analytics, prompts, meeting-tasks, users

- **`app/admin/client-projects/page.tsx`** — Blue–cyan button; progress bar from-blue-500 to-emerald-500.
- **`app/admin/client-projects/[id]/page.tsx`** — Blue–indigo info box and CTA; progress from-blue-500 to-emerald-500.
- **`app/admin/guarantees/page.tsx`** — Gray-500 search.
- **`app/admin/guarantees/[instanceId]/page.tsx`** — Indigo-900/700 info box; green CTA.
- **`app/admin/analytics/page.tsx`** — Indigo–cyan gradient button.
- **`app/admin/prompts/page.tsx`** — Blue–cyan, purple–pink gradient keys.
- **`app/admin/meeting-tasks/page.tsx`** — Violet–purple icon gradient.
- **`app/admin/users/page.tsx`** — Gray-400 search icon.

### Admin – Client dashboard (token-based)

- **`components/client-dashboard/DashboardStatCards.tsx`** — Blue–indigo, purple–violet gradient borders.
- **`components/client-dashboard/WorkshopCountdown.tsx`** — Indigo–purple gradient container.
- **`components/client-dashboard/AccelerationCards.tsx`** — Blue–indigo icon background.

### Popups & marketing

- **`components/ExitIntentPopup.tsx`** — Blue–purple gradient CTA.
- **`components/TimeBasedPopup.tsx`** — Blue–purple gradient CTA.
- **`components/ScrollOffer.tsx`** — from-purple-600 to-blue-600 card.

### Libs (status/semantic)

- **`lib/continuity.ts`** — Status badges: trialing (cyan-900/50, cyan-300, cyan-500), active (green-900/50, green-300, green-500). Semantic; consider mapping to brand-compliant semantic tokens in globals.css.

---

## 3. design.json note

**`design.json`** in the repo root defines the **“Odama Interface Guidelines”** (version 1.0): a separate design system with an **orange-led palette** (Safety Orange #F26522, Tawny #C45E23, Lumber #F4DCC6) and supporting greys. It is **not** the AmaduTown standard.

- **No application code** was found importing or referencing `design.json` for colors. If any future code or tooling reads `design.json` for UI colors, that would be a deviation from AmaduTown; any such references should be called out and removed or switched to globals.css + tailwind.config.ts.

---

## 4. Recommended mapping (brief)

- **Gray backgrounds/borders:** Replace `bg-gray-800`, `bg-gray-900`, `border-gray-700`, `border-gray-800` with `bg-imperial-navy`, `bg-silicon-slate`, `border-silicon-slate` or `border-radiant-gold/20` as appropriate. Use `bg-background` where the page background is intended to match body.
- **Gray text:** Replace `text-gray-300`, `text-gray-400`, `text-gray-500` with `text-foreground` or `text-platinum-white` and opacity/muted variants (e.g. `text-platinum-white/80`) or a dedicated muted utility if you add one in globals.css.
- **Slate everywhere:** Replace `slate-*` with `imperial-navy`, `silicon-slate`, `platinum-white` (and brand gradients) so that animated-scroll, timeline, and hero-parallax use the same palette as the rest of the site.
- **Primary CTAs (cyan–blue or blue–purple):** Replace `from-cyan-600 to-blue-600` and `from-blue-600 to-purple-600` with `.btn-gold` or the brand gradient (e.g. `from-bronze via-radiant-gold to-gold-light`). Use `.btn-ghost` for secondary actions where appropriate.
- **Purple focus/hover:** Replace `focus:border-purple-500`, `hover:border-purple-500` with `focus:border-radiant-gold` (or `.input-brand` which already uses gold focus in globals.css).
- **Accent links and badges:** Replace `text-cyan-400`, `text-purple-400`, `text-blue-400` with `text-gold` or `.gradient-text` / `.text-gold` and gold-based borders/backgrounds.
- **Card/hero gradients:** Replace `from-cyan-900/20 to-blue-900/20` and `from-purple-900/20 to-blue-900/20` with e.g. `from-bronze/20 to-radiant-gold/20` or `from-imperial-navy to-silicon-slate`.
- **Product classifier (light UI):** Redesign to use dark brand (imperial-navy, silicon-slate, platinum-white, radiant-gold) so it matches admin and brand.
- **Semantic green/red/amber:** Keep for success/error/warning where appropriate; optionally introduce semantic tokens in globals.css (e.g. `--success`, `--error`, `--warning`) that align with brand so semantic UI can stay consistent.

---

## 5. Location

This audit is saved at **`docs/design/amadutown-color-palette-audit.md`**. Use it as the single source of truth for where the AmaduTown standard is not followed; remediate in the order that best fits your roadmap (e.g. high-priority public and admin pages first, then shared components and libs).
