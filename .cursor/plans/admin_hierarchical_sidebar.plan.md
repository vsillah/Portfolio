# Admin dashboard: hierarchical sidebar + dashboard home

## Goal

1. **Sidebar:** Persistent left nav with top-level categories and sub-pages (Slack/ElevenLabs/Supabase style) so admins can switch sections without returning to the dashboard.
2. **Dashboard home:** A snapshot of each category with cards that show **feeds of pertinent/most recent info**; each card has links to the corresponding full page. Those links drive the route, so the **sidebar tab in context** updates automatically when the user navigates.

---

## Part 1: Hierarchical sidebar

(Unchanged from original plan.)

- **Layout:** [app/admin/layout.tsx](app/admin/layout.tsx) — sidebar (fixed/sticky left) + main content area.
- **Sidebar:** Dashboard first, then five categories (Pipeline, Sales, Post-sale, Quality & insights, Configuration) with direct links to hub/list pages. Only **Content** is expandable. Active state from `usePathname()`.
- **Detail pages** (e.g. `/admin/guarantees/[id]`) are not in the sidebar; parent (e.g. Guarantees) is highlighted; breadcrumbs show path.
- **Mobile:** Hamburger + drawer with same tree; focus trap, Escape to close.
- **Config:** Single source of truth (e.g. `lib/admin-nav.ts`) for the nav tree.

---

## Part 2: Dashboard home — category snapshot cards with feeds

### Design

- **One card per category** (or per major area): Pipeline, Sales, Post-sale, Quality & insights, Configuration.
- **Each card contains:**
  - A **feed** of the most recent or most pertinent information for that category (e.g. recent leads, latest value reports, recent sales activity, upcoming meeting tasks, latest chat-eval sessions, recent content changes).
  - A **link** (e.g. “View Lead Pipeline”, “Open Sales Dashboard”) to the corresponding full page. These are normal Next.js `Link` hrefs to the same routes used in the sidebar (e.g. `/admin/outreach`, `/admin/sales`). When the user clicks, they go to that route and the **sidebar automatically shows the correct item in context** (active state is route-driven).
- Optional: keep a compact **Analytics overview** block at the top (sessions, page views, etc.) with a link to full Analytics, or fold it into the “Quality & insights” card.

### Feed content per category (locked in)

Each card shows a small feed (counts and/or last N items) and a primary link. Data comes from existing admin APIs where possible; add `limit` or a lightweight dashboard endpoint only when needed.

---

**Pipeline — two cards**

| Card | Feed content | Data source | Link |
|------|----------------|-------------|------|
| **Lead Pipeline** | Funnel counts (total leads, contacted, replied, booked) + queue summary (draft / sent / replied). List: last 5 **recent activity** items (channel, subject, status, contact name, sent/replied date). | `GET /api/admin/outreach/dashboard` — already returns `funnel`, `queueStats`, `recentActivity` (last 10). Use as-is; optionally slice `recentActivity` to 5 in UI. | `/admin/outreach` |
| **Value Evidence** | Counts: total reports, total evidence, total calculations. List: last 5 **recent reports** (title, industry or company size, total_annual_value, created_at). | `GET /api/admin/value-evidence/dashboard` (counts: `totalReports`, `totalEvidence`; topCalculations count or similar). `GET /api/admin/value-evidence/reports` — supports no explicit limit; use default and take first 5 in UI, or add `?limit=5`. | `/admin/value-evidence` |

---

**Sales — one card**

| Card | Feed content | Data source | Link |
|------|----------------|-------------|------|
| **Sales** | Summary: total audits, pending follow-up, converted, high urgency. List: last 5 **recent campaigns** (name, status, enrollment_count, created_at) OR last 5 **diagnostic audits** (contact name, urgency/opportunity, outcome if any). | Campaigns: `GET /api/admin/campaigns?limit=5` (add `limit` if not supported; API currently uses `limit` default 50). Audits: `GET /api/admin/sales` returns all completed audits — use first 5 in UI, or add optional `limit=5` to this API for dashboard. Prefer one list (campaigns or audits); if both, show campaigns as primary feed and “X audits need follow-up” as count from `/api/admin/sales` stats. | `/admin/sales` (primary); optional secondary link “Campaigns” → `/admin/campaigns`. |

---

**Post-sale — one card**

| Card | Feed content | Data source | Link |
|------|----------------|-------------|------|
| **Post-sale** | List: last 5 **client projects** (client_name, project_status, current_phase, created_at). Count or list: **meeting tasks** — e.g. “N pending tasks” and last 3–5 tasks (title, status, due_date, project/client). List: last 3 **guarantee instances** (template name, status, client_email, created_at). | Client projects: `GET /api/admin/client-projects?limit=5` (add `limit` if not supported; currently `limit=50`). Meeting tasks: `GET /api/meeting-action-tasks` returns all; no `limit` in API — slice to 5 in UI, or add `?limit=5` to API. Guarantees: `GET /api/admin/guarantees?limit=3` (API supports `limit`). Show one primary list (e.g. client projects) and 1–2 count/summary lines for the others, or two rows (projects + tasks) with “View all” per section. | `/admin/client-projects`, `/admin/meeting-tasks`, `/admin/guarantees` — one primary “View Post-sale” → `/admin/client-projects` or a hub; or three small links (Projects, Meeting tasks, Guarantees). |

---

**Quality & insights — one card**

| Card | Feed content | Data source | Link |
|------|----------------|-------------|------|
| **Quality & insights** | **Chat Eval:** Sessions (7d or 30d) count, evaluated count, success rate; list: last 5 **sessions** (session_id or visitor_email, rating if evaluated, created_at). **Analytics:** Sessions, page views, clicks, form submits (7d) — reuse existing stats. **E2E Testing:** Last run date/status or “Run tests” CTA if no run. | Chat: `GET /api/admin/chat-eval/stats?days=7` (counts + rates). List: `GET /api/admin/chat-eval?limit=5` (API supports `limit`; default 20). Analytics: `GET /api/analytics/stats?days=7` (existing). E2E: no API assumed — show “E2E Testing” link only, or add a small “last run” endpoint later. | `/admin/chat-eval`, `/admin/analytics`, `/admin/testing` — primary link “Quality & insights” → `/admin/chat-eval`; include “Analytics” and “E2E Testing” as secondary links or fold analytics counts into same card. |

---

**Configuration — one card**

| Card | Feed content | Data source | Link |
|------|----------------|-------------|------|
| **Configuration** | No live feed required for v1. Show: short summary line (“Content hub, users, system prompts”) and 3 links: **Content Hub**, **User Management**, **System Prompts**. Optional later: “Recently updated” (e.g. last 3 products or last 2 prompt keys) if lightweight endpoints exist. | No dashboard-specific API for v1. Optional: products list or prompts list with `limit=3` if available. | `/admin/content`, `/admin/users`, `/admin/prompts` — one card with three links; primary “Content Hub” → `/admin/content`. |

---

### API changes (minimal)

- **Outreach:** None; dashboard already returns `recentActivity` and counts.
- **Value evidence:** Optional: `GET /api/admin/value-evidence/reports?limit=5` (today uses `.limit(50)`; add searchParam for limit).
- **Sales:** Optional: `GET /api/admin/sales?limit=5` or keep and slice first 5 in UI; `GET /api/admin/campaigns` already supports `limit`, use `limit=5` for dashboard.
- **Client projects:** Optional: `GET /api/admin/client-projects?limit=5` (currently `limit=50`; add searchParam).
- **Meeting tasks:** Optional: add `limit` to `GET /api/meeting-action-tasks` or slice in UI.
- **Guarantees:** Already supports `limit`; use `limit=3` for dashboard.
- **Chat eval:** `GET /api/admin/chat-eval?limit=5` and `GET /api/admin/chat-eval/stats?days=7` — no change.
- **Analytics:** `GET /api/analytics/stats?days=7` — no change.
- **Configuration:** No API for v1.

### Sidebar context

- No extra logic needed: **links go to the same routes as the sidebar**. When the user clicks “View Lead Pipeline” → `/admin/outreach`, the layout’s sidebar uses `pathname` to set the active item, so “Lead Pipeline” is in context. Same for any other link to a sidebar route.

---

## Implementation tasks (combined)

1. Add sidebar nav config and `AdminSidebar` component; update admin layout (sidebar + main; mobile drawer).
2. **Dashboard home:** Redesign [app/admin/page.tsx](app/admin/page.tsx) into **category-snapshot cards** per the locked-in feed table above:
   - Pipeline: two cards (Lead Pipeline, Value Evidence); Sales, Post-sale, Quality & insights, Configuration: one card each (Configuration = three links, no feed in v1).
   - Each card: feed component (counts + list of N items as specified) + primary link (and secondary links where noted); use existing APIs and optional `limit` params as in “API changes (minimal)”.
   - Keep payloads small (slice to 5 in UI where API has no limit, or add `limit` to API).
3. Ensure deep links and active state work (sidebar highlights parent for detail pages; breadcrumbs unchanged).
4. Docs and rules: admin-features.mdc (add to sidebar config); SOP quick reference (sidebar + dashboard design).

---

## Files to add or change

| Action | File |
|--------|------|
| Add | `lib/admin-nav.ts` — nav tree |
| Add | `components/admin/AdminSidebar.tsx` — sidebar UI |
| Edit | `app/admin/layout.tsx` — sidebar + main, mobile hamburger/drawer |
| Edit | `app/admin/page.tsx` — replace current card grid with category-snapshot cards and feeds; links to sidebar routes |
| Add (optional) | Dashboard feed APIs or reuse existing list/stats endpoints |
| Edit | `.cursor/rules/admin-features.mdc` — add to sidebar config |
| Edit | `docs/admin-sales-lead-pipeline-sop.md` — quick reference |

---

## Verification

- Dashboard: each category card shows a feed and a link; link goes to the right admin page and sidebar highlights the correct item.
- Navigating from sidebar only: same behavior.
- Detail page (e.g. `/admin/guarantees/123`): Guarantees highlighted in sidebar; breadcrumbs show path.
- Mobile: drawer opens; same links; focus trap and Escape close.
