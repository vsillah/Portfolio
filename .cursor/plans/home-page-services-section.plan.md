# Home Page Services Section — Implementation Plan

**Overall Progress:** `100%`

## TLDR
Add a Services section to the home page so visitors see active service offerings (training, speaking, consulting, etc.) without navigating to `/services`. Follow the existing home section pattern (Store, Projects, etc.) for consistency.

## Critical Decisions
- **Reuse ServiceCard vs inline cards:** Inline cards following the Store.tsx premium style — `ServiceCard` is designed for the `/services` page with add-to-cart actions; the home section should be a showcase with "View Details" linking to `/services`, matching the Store section's visual language.
- **Placement:** Between Store and About — services are a commercial offering like the store, so they belong in that zone of the page.
- **Data:** Fetch `/api/services?active=true&featured=true`, show up to 6 featured/active services sorted by display_order. No API changes needed.

## Tasks:

- [x] 🟩 **Step 1: Create `components/Services.tsx`**
  - [x] 🟩 Follow Store.tsx pattern: `useEffect` fetch on mount, loading skeleton, section with `id="services"`
  - [x] 🟩 Fetch `/api/services?active=true`, sort featured first, slice to 6
  - [x] 🟩 Header: pill-badge (Briefcase icon, cyan accent), title "Services", subtitle
  - [x] 🟩 Grid: 3-column responsive grid of service cards (image/icon, type badge, delivery badge, title, description, price/CTA)
  - [x] 🟩 "View All" link to `/services` at bottom (ArrowRight pattern from Store)
  - [x] 🟩 Use premium design tokens (`imperial-navy`, `radiant-gold`, `platinum-white`, `silicon-slate`) consistent with other sections

- [x] 🟩 **Step 2: Wire into `app/page.tsx`**
  - [x] 🟩 Import `Services` from `@/components/Services`
  - [x] 🟩 Render `<Services />` between `<Store />` and `<About />`

- [x] 🟩 **Step 3: Add analytics tracking**
  - [x] 🟩 Add `'services'` to the `sections` array in the IntersectionObserver (line 47)

- [x] 🟩 **Step 4: Verify**
  - [x] 🟩 Confirm section renders on home page with active services
  - [x] 🟩 Confirm "View All" links to `/services`
  - [x] 🟩 Confirm section view analytics fires on scroll
  - [x] 🟩 Confirm empty state (no services) hides the section gracefully
