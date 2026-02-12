# Services content on home page

**Type:** Feature  
**Priority:** Normal  
**Effort:** Medium  

---

## TL;DR

Add a Services section to the home page so visitors see service offerings (trainings, speaking, consulting, etc.) without having to go to `/services`. Right now the home page has no services content.

---

## Current state

- Home page (`app/page.tsx`) renders: Hero, Projects, AppPrototypes, Publications, Music, Videos, Store, About, Contact.
- Services exist in the app: `/services` page and `/api/services` work; admin can manage services. No services block on the home page.

## Expected outcome

- Home page includes a Services section (e.g. “Services” or “Offerings”) that shows active services (title, type, delivery, price/CTA, link to full `/services` or to contact).
- Section matches existing home sections in style and behavior (fetch from API, optional “View all” to `/services`).

---

## Relevant files

- **`app/page.tsx`** — Add a Services section (import + render a Services component, add section id for analytics if desired).
- **`components/`** — New component (e.g. `Services.tsx` or `ServicesSection.tsx`) that fetches `/api/services?active=true` and renders a grid/list; can reuse patterns from `app/services/page.tsx` or `components/ServiceCard.tsx`.
- **`app/page.tsx`** (analytics) — If section view tracking is used, add `'services'` to the `sections` array in the IntersectionObserver so the new section is tracked.

---

## Notes / risks

- Reuse `ServiceCard` or the public services page layout so design stays consistent and duplication is minimal.
- Only show active services; respect existing API (`active=true`). No schema or API changes required.
