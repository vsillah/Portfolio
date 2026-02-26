# ElevenLabs Audio Native for Publications (revised)

## Direction: per-publication player inside each card

**UX recommendation (lead-ux-designer):** One ElevenLabs embed **per publication**, embedded **inside the existing publication card** (footer, after primary CTAs). No shared section-level player.

**Rationale:** Clear "this card = this audio" mapping; no "which title is playing?"; scan-and-listen from the grid; only one player plays at a time (pause others when one starts). When a publication has no audio, omit the player block entirely—no disabled state or placeholder.

---

## Audiobook download and bundle with e-book

- **Requirement:** Users can **download the audiobook for offline listening**, using the **same lead magnet structure** as the Accelerated e-book (auth-gated, signed URL or external URL from `lead_magnets`).
- **Bundle rule:** When a publication has **both** an e-book lead magnet and an audiobook lead magnet, they are **one package**: same auth gate (one “Get free” / sign-in), then both “Download Ebook” and “Download Audiobook” are offered. No separate claim for each.
- **Implementation:** Add an **audiobook lead magnet** per publication via a second FK on `publications` (`audiobook_lead_magnet_id`). Each lead magnet is still one file (ebook or audiobook); the publication is the bundle. Existing download API `GET /api/lead-magnets/[id]/download` is reused for both.

---

## Data model (revised)

- **Per-publication config:** Store ElevenLabs embed config **on each publication**, not in a single section setting.
- **Option A (recommended):** Add columns to `publications`:
  - `elevenlabs_project_id TEXT` (nullable)
  - `elevenlabs_public_user_id TEXT` (nullable)
  - Optional: `elevenlabs_player_url TEXT`, or derive from project.
- **Option B:** Single JSONB column `elevenlabs_embed_config JSONB` (nullable) with `{ projectId, publicUserId, playerUrl? }`.
- **Rule:** If both project ID and public user ID are set for a publication, show the in-card player; otherwise do not render any player block for that card.

**Audiobook (lead magnet) bundle:**

- **`publications.audiobook_lead_magnet_id`** — nullable UUID FK to `lead_magnets(id)`. When set, this publication offers an audiobook download (same lead magnet flow: `file_path` or `file_url` in `lead_magnets`, auth-gated download).
- **`lead_magnets.type`** — add **`'audiobook'`** to the existing check constraint (`pdf`, `ebook`, `document`, `link`, `interactive` → add `audiobook`). Admin can create lead magnets with `type = 'audiobook'` and upload/store an audio file (e.g. MP3/M4A) in the same `lead-magnets` bucket or use an external `file_url`.

---

## API

- **Publications API** (existing `GET /api/publications`): Include (1) the new ElevenLabs fields (or `elevenlabs_embed_config`) in the response so the home page can render per-card players; (2) **`linked_audiobook_lead_magnet`** — same shape as `linked_lead_magnet` (`id`, `slug`, `title`) resolved from `audiobook_lead_magnet_id` when present, so the card can show “Download Audiobook” and use the existing download endpoint.
- **Admin:** In Publications management (edit publication form), add: ElevenLabs embed fields (Project ID, Public user ID); **Audiobook lead magnet** — optional picker/link to select an existing lead magnet with `type = 'audiobook'` (or create one). Save via existing `PUT /api/publications/[id]` (include `audiobook_lead_magnet_id` and new ElevenLabs fields).
- **Ebook API** (`GET /api/ebook/[slug]`): When the lead magnet is linked to a publication (via `publications.lead_magnet_id`), also return **`audiobook_lead_magnet`** (id, slug, title) when that publication has `audiobook_lead_magnet_id` set, so the ebook landing page can show “Download Audiobook” as part of the same package.
- **Download:** Reuse existing `GET /api/lead-magnets/[id]/download` for both e-book and audiobook; response includes `downloadUrl` (and optionally `fileName`/extension for audiobook). No new download API.

No new `site_content_settings` table or publications-audio settings API.

---

## Home page: Publications component

- **Per card:** For each publication that has `projectId` and `publicUserId` (or equivalent), render the ElevenLabs embed **inside that card’s footer**, after primary CTAs (Download/Buy, Learn More), before or alongside "View on Amazon."
- **Component:** Reusable client component (e.g. `PublicationsElevenLabsEmbed` or `PublicationCardAudio`) that:
  - Accepts `projectId`, `publicUserId`, `publicationTitle`, optional `playerUrl` / colors.
  - Renders the ElevenLabs div + script (script loaded once globally, not per card).
  - Uses a **compact one-row** layout: play/pause + "Listen" (or "Listen to sample"); Amadutown styling (e.g. same footer border/padding, secondary style like "View on Amazon").
  - Exposes an accessible name: "Listen to [Publication title]."
- **One-at-a-time playback:** When one card’s player starts, pause any other ElevenLabs player on the page (shared state or event/callback so only one plays).

**Audiobook download (bundle with e-book):**

- When a publication has **both** `linked_lead_magnet` (ebook) and `linked_audiobook_lead_magnet`: one auth gate (“Get free ebook & audiobook” or “Get free”); after login, show **two** primary actions: “Download Ebook” and “Download Audiobook” (same `handleLeadMagnetDownload`-style flow with the respective lead magnet id). Optional: “Listen” (ElevenLabs) row below.
- When only **ebook** lead magnet: keep current behavior (“Download Free Ebook” / “Get Free Ebook”).
- When only **audiobook** lead magnet: single CTA “Download Free Audiobook” / “Get Free Audiobook” (same auth + download API).
- “Learn More” and “View on Amazon” remain as today. Order in footer: primary download(s) first, then Learn More, then Listen (if ElevenLabs), then View on Amazon.

---

## Ebook landing page (`/ebook/[slug]`)

- When the ebook lead magnet is linked to a publication that has an **audiobook** lead magnet, the API returns `audiobook_lead_magnet: { id, slug, title }`.
- On the landing page: after the main “Download Ebook” CTA (and post-download offer), show a **second CTA: “Download Audiobook”** (same auth gate: if not logged in, redirect to login with return path; if logged in, call `/api/lead-magnets/[audiobookId]/download` and trigger file download). Copy: e.g. “Also available: download the audiobook for offline listening.”
- Ensures the **bundle is available in one place**: users who land on the ebook page can get both ebook and audiobook from the same page.

---

## Admin: Publications management

- **Edit publication form:** Add:
  1. **Optional section “Audio (ElevenLabs)”** — Project ID, Public user ID (and optional Player URL). Help text: “From ElevenLabs → Audio Native → your project → Embed. Add this domain to the whitelist. Leave blank if this publication has no in-page player.”
  2. **Optional “Audiobook lead magnet”** — Picker or dropdown to link an existing lead magnet with `type = 'audiobook'` (or “Create audiobook lead magnet” flow that creates a new lead magnet with type `audiobook`, file upload to `lead-magnets` bucket or external URL). Save as `audiobook_lead_magnet_id`.
- **Lead magnets:** Ensure admin can create/edit lead magnets with **type = `audiobook`** (migration adds `audiobook` to the type check). Audiobook lead magnets use the same `file_path` / `file_url` and download flow as ebooks (e.g. MP3/M4A in bucket or hosted URL).
- Save with the rest of the publication (existing PUT). No separate settings page.

---

## Design alignment (Amadutown)

- **Footer block:** Same border and padding as existing CTAs; "Listen" at **secondary** visual weight (e.g. outline/secondary button style like "View on Amazon").
- **Colors:** If ElevenLabs supports them, use e.g. silicon-slate background, platinum-white text so the embed fits the card.
- **Mobile:** One row; touch target ≥44px for play/pause; avoid large card height growth.

---

## UX guidelines (from lead-ux-designer)

1. **Placement:** Audio row in card **footer**, **after** primary CTAs, in the same bordered block.
2. **Labeling:** "Listen" or "Listen to sample" + aria-label "Listen to [Publication title]."
3. **No audio:** Omit player block entirely for that publication; no disabled control, no placeholder.
4. **One-at-a-time:** Start one → pause others (section or site-wide).
5. **Compact:** Single row; optional expand for minimal progress; no large waveform in default card.

---

## Files to add or touch (revised)

| Area | File | Change |
|------|------|--------|
| DB | New migration (publications) | Add `elevenlabs_project_id`, `elevenlabs_public_user_id`; add `audiobook_lead_magnet_id` UUID FK to `lead_magnets`. |
| DB | New migration (lead_magnets) | Add `'audiobook'` to `lead_magnets_type_check`. |
| API | `app/api/publications/route.ts` | Return ElevenLabs fields and `linked_audiobook_lead_magnet` (resolve from `audiobook_lead_magnet_id`). |
| API | `app/api/publications/[id]/route.ts` | Accept and validate ElevenLabs fields and `audiobook_lead_magnet_id` on PUT. |
| API | `app/api/ebook/[slug]/route.ts` (or equivalent) | When lead magnet is linked to a publication, return `audiobook_lead_magnet` when that publication has `audiobook_lead_magnet_id`. |
| Component | New `components/PublicationCardAudio.tsx` (or inline) | Per-card ElevenLabs embed; compact row; load script once; one-at-a-time playback. |
| Home | `components/Publications.tsx` | Render embed in card footer when ElevenLabs config present; add "Download Audiobook" when `linked_audiobook_lead_magnet` present (bundle: both download buttons, copy "Get free ebook & audiobook" when both). |
| Ebook | `app/ebook/[slug]/page.tsx` | When API returns `audiobook_lead_magnet`, show "Download Audiobook" CTA; same auth + download flow. |
| Admin | `app/admin/content/publications/page.tsx` | Add ElevenLabs fields and audiobook lead magnet picker/link; save with publication. |
| Admin | Lead magnet create/edit (where type is set) | Allow `type = 'audiobook'` in dropdown/validation. |

---

## Verification

- Build/lint pass.
- Home: cards with ElevenLabs config show a "Listen" row; cards with ebook + audiobook show both "Download Ebook" and "Download Audiobook" after login; only one player plays at a time.
- Download: create an audiobook lead magnet, link to a publication; on home (and ebook page when applicable), confirm "Download Audiobook" returns a file (signed URL or external URL).
- Ebook landing: for an ebook that belongs to a publication with an audiobook, confirm "Download Audiobook" appears and works.
- Admin: set Project ID + Public user ID; link audiobook lead magnet; save; confirm on home and ebook page.
