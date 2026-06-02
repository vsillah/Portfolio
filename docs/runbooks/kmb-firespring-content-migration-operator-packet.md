# KMB Firespring Content Migration Operator Packet

Status: prep packet for proof-site handoff
Prepared: 2026-06-02
Client: Keep Massachusetts Beautiful
Primary stakeholder: Neil Rhein
Vendor platform: Firespring Springboard CMS
Execution surface: Computer Use against Firespring/Springboard UI

## Objective

Use the Firespring proof site as the workspace for KMB's Balance-template content migration so Vambah does not need to learn or manually operate Firespring admin pages.

Codex should handle UI familiarization, proof-site navigation, content edits, screenshots, redirect tracking, and QA through Computer Use once Firespring provides the new Balance proof site and credentials/access.

## Trigger And Approval Model

The operational trigger for migration work is the follow-up meeting with Neil after the Balance proof-site handoff. When those meeting notes land, use them to refresh the task split, page decisions, navigation decisions, and open gates before touching Firespring.

Agent Ops backlog item:

- Work item: `74bc8d5d-d3b4-49e5-b425-69344fdce073`
- Active run: `552f4368-b40d-4952-92a8-1e95cf8da3af`
- Owner agent: `website-product-copy`
- Status: `proposed`
- Priority: `high`

Expected access path:

- Firespring credentials are expected to be available in 1Password.
- Codex may use Computer Use to access the browser, 1Password/browser credential flow, and Firespring/Springboard after Vambah approves the work session.
- If 1Password is locked, Vambah handles the unlock step or provides the supported login handoff. Codex should not ask Vambah to paste passwords into chat.

Human-in-the-loop gate:

- Vambah remains the HITL approver for public-impacting actions.
- Codex can perform reconnaissance, draft edits, proof-site edits, screenshots, preview checks, QA, and documentation after the work session is approved.
- Codex must pause before final actions that publish public content, delete data, alter live routing, submit vendor-facing changes, or otherwise affect the live site.
- Once Neil's follow-up meeting decisions are clear, Codex should proceed through the approved proof-site task batch without asking Vambah to learn Springboard manually.

## Source Package

Primary local package:

`/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Client Projects /KMB/`

Primary current workbook:

`/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/kmb-content-inventory-balance.xlsx`

The current workbook has these execution sheets:

- `URL Inventory`
- `Site Structure Map`
- `Balance Layout Library`
- `Migration Plan`
- `Summary Dashboard`

Primary PRD:

`/Users/vambahsillah/Documents/Codex/2026-05-16-i-need-to-pull-together-a/firespring-kmb-template-migration-prd.md`

Read AI source meetings:

- `01KNMK2EKVR4320XFRZQHT5RQA` - Website Template Migration
- `01KQYZWAF5CVYZX7XCT1393JCV` - Neil/Vambah URL inventory and wireframe review
- `01KSMYSRJATH4M1B9YEFCPE77N` - KMB/Firespring Requirements Review

## Firespring Training Sources

Official Firespring entry points:

- Client Area: `https://www.firespring.com/client-area/nonprofit-websites/page.html`
- Springboard Login: `https://accounts.firespring.com/login`
- Video Tutorials: `https://www.firespring.com/client-area/videos/page.html`
- Training Webinars: linked from the Client Area
- Get Support: linked from the Client Area

Priority videos for this migration:

- Springboard Overview
- Managing Content
- Add a Page
- Content Templates
- Building a Draft Page
- Landing Pages
- Content Blocks
- Sections
- Text
- Adding Images
- Message Center, only if contact-message routing is touched
- Springboard File Transfer, only if assets must be uploaded

Firespring public notes that matter:

- Springboard is Firespring's proprietary nonprofit CMS.
- Firespring says clients can control images and content through Springboard.
- Firespring says support includes video tutorials, FAQs, and live training webinars.
- Firespring's 2019 content-location note says Website Content screens use a left menu of page content locations, and `Add Content` places new content in the selected location.

## KMB Artifacts To Use

Use these as the working artifact set:

- `kmb-firespring-cms-guide.docx`
- `kmb-quality-checklist.docx`
- `kmb-worked-example.md`
- `KMB Content Inventory Analysis.gsheet`
- `kmb-content-inventory-balance.xlsx`
- `KMB Migration Feedback Recommendation 2026-05-06.xlsx`
- `KMB Modified Balance Wireframe Brief 2026-05-06.md`
- `KMB Paper Polished Wireframe Handoff 2026-05-06.md`
- `KMB Paper Polished Desktop v2.jpg`
- `KMB Paper Polished Mobile.jpg`
- `KMB Paper Nina Handoff.jpg`
- `KMB Paper Spreadsheet Feedback Applied Map.jpg`
- `kmb-balance-fidelity-sections/`
- `kmb-source-images/`
- `2026-04-07 KMB Website Template Migration Transcript.txt`

## Precedence Rule

The newer PRD and Read AI meetings override older CMS-guide navigation instructions.

Important conflict:

- Older guide model: `About Us`, `For Volunteers`, `For Businesses`, `For Policymakers`, `Contact Us`, `Donate`.
- Current Balance migration model: `About Us`, `What We Do`, `Take Action`, `Support`, `News & Events`, with Donate and Get Involved as persistent action controls.

Do not execute the older guide's navigation restructure unless Neil explicitly re-approves that model.

## Current Migration Direction

Use Balance as the proof-site default.

Keep the five top-level labels available:

- `About Us`
- `What We Do`
- `Take Action`
- `Support`
- `News & Events`

Working prototype order:

- `What We Do`
- `Take Action`
- `Support`
- `News & Events`
- `About Us`

Keep these visible or easy to reach:

- Donate
- Get Involved or equivalent action control
- Search
- Language translation / gtranslate
- Events
- Forms
- Sponsor visibility
- Critical legacy URLs and campaign paths

KMB brand values:

- Clean
- Funder credible
- White/blue/green identity
- Not too playful

Known brand colors from the May 27 requirements review:

- Green: `#71992B`
- Blue: meeting note captured `0055`; confirm full six-character hex before applying.

## Proof-Site Safety Rules

- Work only on the Firespring proof site until Neil approves launch.
- Do not change the live KMB site unless Vambah explicitly asks for a direct live edit.
- Take before screenshots of the homepage, navigation, donation page, and any page being edited.
- Draft page copy outside Firespring before pasting into the CMS.
- Do not delete pages as a first move. Hide, unpublish, draft, or archive when possible.
- Track every renamed, merged, hidden, archived, or removed URL in the redirect map.
- Preserve known short/campaign paths such as `/GMC` unless a redirect has been approved.
- Any final live publish or public website content edit through Computer Use requires action-time confirmation.

## Computer Use Execution Protocol

When the Balance proof site is available:

1. Open Firespring Springboard through Computer Use.
2. Log in only with approved KMB/Firespring credentials or saved browser credentials.
3. Confirm the environment banner/domain is the proof site, not the live site.
4. Capture screenshots before edits.
5. Locate the Website Content or equivalent page/content editor.
6. Use the Firespring videos and current proof-site UI to map:
   - page list
   - navigation editor
   - content locations
   - draft/publish controls
   - media/file upload flow
   - redirects flow
7. Make one small content/navigation change first, then preview.
8. Record the page, old URL, new URL if changed, edit summary, screenshot path, and QA result.
9. Continue in batches by page group from the current workbook.
10. Pause before any final action that publishes public content, deletes data, or changes live routing.

## First Proof-Site Pass

Start with discovery and no content changes:

- Verify proof-site URL and admin access.
- Screenshot current proof homepage, nav, donate path, events path, and language/search controls.
- Identify whether Balance uses page locations, content blocks, sections, templates, or all three.
- Confirm where drafts/previews are controlled.
- Confirm whether old events can be bulk archived or must be handled one-by-one.
- Confirm redirect tooling location.
- Confirm asset upload/file-transfer flow.
- Confirm whether homepage impact metrics are editable as content blocks or template settings.

Then perform a small reversible edit only after the environment is confirmed:

- Prefer a draft-only text edit on a low-risk proof page.
- Preview.
- Revert or leave draft according to the migration plan.
- Document the exact click path.

## Content Migration Batches

Recommended batch order:

1. Homepage skeleton and persistent controls.
2. Navigation labels and action controls.
3. Donation/support path.
4. What We Do program pages.
5. Take Action volunteer/cleanup pages.
6. Events and news retention/archive decisions.
7. Image replacement and alt text pass.
8. Redirect map and broken-link pass.
9. Mobile QA.
10. Neil review packet.

## QA Checklist

Use `kmb-quality-checklist.docx`, with these current additions:

- Confirm five-label Balance navigation is preserved unless Neil re-approves a different model.
- Confirm Donate remains prominent on desktop and mobile.
- Confirm gtranslate remains visible and functional.
- Confirm search still works.
- Confirm events list/card behavior matches the proof-site decision.
- Confirm no page-body copy points users to old navigation labels.
- Confirm every merged/archived page has a redirect recommendation.
- Confirm homepage impact metrics use the approved source for this phase.
- Confirm image duplication and poor-fit images are flagged before launch.
- Confirm mobile nav keeps Donate/action controls findable.

## Current Open Gates

- Firespring has not yet delivered the Balance proof site.
- Need proof-site URL.
- Need admin access or a supported login handoff.
- Need full six-character KMB blue hex value.
- Need Nina's answer on bulk deletion/archive of historical events.
- Need Neil's final approval on top-nav order and any merge/archive rows still marked review.
- Need redirect map before launch.

## Roadmap Status

Completed:

- Source package located.
- Firespring tutorial entry points located.
- Read AI source meetings identified.
- Current PRD and workbook identified.
- Stale navigation conflict recorded.
- Computer Use execution path defined.

Next Codex-owned step:

When the proof-site handoff arrives, Codex should use Computer Use to perform a no-edit admin reconnaissance pass, capture screenshots, map the UI controls, and return a proof-site click-path report before migrating content in batches.

Next user/vendor-owned step:

Firespring/Nina needs to provide the Balance proof-site URL, support-team contact, and admin access path. Neil needs to confirm the final navigation order and the complete KMB blue hex value before styling changes are applied.
