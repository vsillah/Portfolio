# Superseded Agentified standalone calendar review

These files document the earlier standalone review route. That route now redirects to Portfolio's canonical Release Calendar. Do not use these MP4s for Human QA of the current PR head.

Reviewed product and calendar-projection commit: `ae618e151c0eb8414cb52826c2b1528a94f318e1`

Captured local review route: `http://localhost:3017/admin/agents/content-intelligence/agentified-calendar?asset=AW-IG-CAR-01&rev=ae618e151c0eb8414cb52826c2b1528a94f318e1`

The desktop and 390 × 844 mobile MP4s are twelve-second walkthroughs assembled from fresh browser captures of the committed local route after the main Release Calendar projection was added. They show the ten inactive Drafts, an expanded Instagram carousel record, its source-bound copy and visual previews, the blocked-action explanation, and channel filtering to two Instagram rows. The local server used inert Supabase placeholders with outbound n8n disabled. No import, database write, provider action, schedule, publish, email, outreach, or paid X call was performed.

| Evidence or source | SHA-256 |
| --- | --- |
| `desktop-walkthrough.mp4` | `3079b618ff532006eb3424c638072558820a90405bd53d307615a3c6b91d9586` |
| `mobile-walkthrough.mp4` | `1aa2b40363fea99f04bc038ccd218a55f23d54cdabc8a49d85ff084ab865d63f` |
| `agentified/campaign/portfolio-campaign-packet.json` | `728afcf216c61d6cb309a7684ca22cf8f7b44fdaefd191de8444fda4a4ec5be8` |
| `agentified/campaign/draft-assets.md` | `ae1694fdf935178c049d9f067a9450920e33c6110ea0bebee54aa26d6835b8e6` |
| `public/agentified/campaign-review/2026-11-23/manifest.json` | `0448c3440c60cd83ea2abfb0e8d2567a80d355599540b93a6539b12a6731828f` |

Both MP4s decoded completely with FFmpeg. The desktop file is 1728 × 962 and the mobile file is 390 × 844; each is H.264, 12 seconds, 288 frames.

The mobile browser was at 150% display scaling, so its viewport override was 260 × 563 device units to yield an exact 390 × 844 CSS-pixel viewport. `document.documentElement.scrollWidth` was 390. The existing admin layout and review card remained readable at that width.

Source visual bytes are unchanged and validated against `public/agentified/campaign-review/2026-11-23/manifest.json`. These clips document the Draft binding only; they do not approve campaign content or external execution.

The main Release Calendar now requests these read-only rows through `include_agentified_drafts=1` and links each row to the source-bound Details view. Its direct authorize, edit, and reject routes fail with 409 for virtual Draft IDs. The main admin route redirected to `/auth/login` in the inert local environment, so its populated list could not be visually inspected without a real authenticated backend. The API projection, duplicate ownership guard, inactive state, and route locks were verified with focused tests; the exact review route was visually inspected at desktop and 390 × 844.
