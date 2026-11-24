# Agentified calendar Draft review

Code commit: `f5fa0bd5e`

Local review route: `http://localhost:3017/admin/agents/content-intelligence/agentified-calendar?asset=AW-IG-CAR-01&rev=f5fa0bd5e`

The desktop and 390 × 844 mobile MP4s are nine-second walkthroughs assembled from browser captures of the committed local route. They show the ten inactive Drafts, an expanded Instagram carousel record, its source-bound copy and visual previews, the blocked-action explanation, and channel filtering to two Instagram rows. The local server used inert Supabase placeholders with outbound n8n disabled. No import, database write, provider action, schedule, publish, email, outreach, or paid X call was performed.

The mobile browser was at 150% display scaling, so its viewport override was 260 × 563 device units to yield an exact 390 × 844 CSS-pixel viewport. `document.documentElement.scrollWidth` was 390. The existing admin layout and review card remained readable at that width.

Source visual bytes are unchanged and validated against `public/agentified/campaign-review/2026-11-23/manifest.json`. These clips document the Draft binding only; they do not approve campaign content or external execution.

The main Release Calendar now requests these read-only rows through `include_agentified_drafts=1` and links each row to the source-bound Details view. Its direct authorize, edit, and reject routes fail with 409 for virtual Draft IDs. The main admin route redirected to `/auth/login` in the inert local environment, so its populated list could not be visually inspected without a real authenticated backend. The API projection, duplicate ownership guard, inactive state, and route locks were verified with focused tests; the exact review route was visually inspected at desktop and 390 × 844.
