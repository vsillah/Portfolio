# Admin Add/Edit Form Display Patterns — UX Evaluation

## Current State

### Two patterns exist in the admin dashboard

| Area | Pattern | Examples |
|------|---------|----------|
| **Content Hub** (content management) | **Inline form** — form appears in-page at top, pushes list down; no automatic scroll | Products, Services, Publications, Videos, Discount Codes, Lead Magnets, Projects, Prototype demos |
| **Sales / Outreach / Client projects** | **Modal** — overlay (`fixed inset-0`), centered panel, explicit Close/Cancel, list stays visible behind | Bundles (Create/Edit/View), Proposal, Save-as-Bundle, Add Lead, Review & Enrich, Create Project, Upsell Paths |

### Content pages — consistent behavior (no scroll-into-view)

- **All Content pages** (Products, Services, Publications, Videos, Discount Codes, Lead Magnets, Projects) use the same pattern: **inline form** at the top of the page when Add or Edit is clicked; **no** automatic scroll into view.
- The form appears in place; the user scrolls to it if needed. This is the preferred behavior across Content.
