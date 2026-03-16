# Post-Sale Documentation: Contract + Onboarding Plan (Reference PDFs)

**Purpose:** Integrate formal **Software Agreement (contract)** and **ATAS Client Onboarding Plan**–style documents into the proposal and post-sale workflow, using the attached reference PDFs as the target format.

**Reference documents (user-provided):**
- **AmaduTown Advisory Solutions Software Agreement** — formal contract with Parties, Services, Term, Compensation, Payment, Expenses, Disputes, Legal Notice, Confidentiality, Assignment, Governing Law, Severability, Entire Agreement, Signatures.
- **ATAS Client Onboarding Plan (Draft)** — structured onboarding with: Initial Setup and Access Requirements; Expected Milestones (week-by-week); Communication Plan; Win Conditions; Warranty Period; Artifacts Handoff.

---

## 1. Contract: Software Agreement

### 1.1 Structure (from reference PDF)

| Section | Content / placeholders |
|--------|------------------------|
| I. The Parties | Contract date, Consultant (name, address), Client (name, address, city, state) |
| II. Services | [WHAT YOU'RE BUILDING/PROVIDING], Required from the client: [REQUIREMENTS] |
| III. Term | Start date, End date / completion / termination notice / Other |
| IV. Compensation | Per hour, Per job (total), Commission, Other |
| V. Payment | Schedule: weekly/monthly/quarterly, completion, invoice, or Other (e.g. 50% on signing, 50% on completion) |
| VI. Expenses | Consultant responsible / Reimbursed for listed / Not required |
| VII–XIII | Disputes, Legal Notice, Confidentiality & Proprietary Information, Assignment, Governing Law, Severability, Entire Agreement |
| Signatures | Consultant signature, date, print name; Client signature, date, print name |

### 1.2 Chosen approach: Separate contract + own signature flow

- **Contract = separate PDF** generated from the Software Agreement template, stored and linked via `proposals.contract_pdf_url`.
- **Contract has its own signature flow:** Capture client name + date (and optionally IP) for the contract separately from the proposal. Store on the proposal row, e.g. `contract_signed_at`, `contract_signed_by_name` (and optionally `contract_signed_ip`). This gives a clear audit trail: proposal signed at X, contract signed at Y.
- **One email only:** Admin sends a **single email** to the client containing **one link** (e.g. `https://amadutown.com/proposal/[code]`). No separate emails for proposal vs contract.
- **Same session:** The client opens that one link and, within a **single session** (one visit, one access code):
  - Can **view** the Proposal PDF and the Software Agreement (Contract) PDF (e.g. tabs, accordion, or two “View / Download” buttons).
  - **Signs the proposal** (existing flow: type name → proposal `signed_at` / `signed_by_name` recorded).
  - **Signs the contract** (new flow: type name → contract `contract_signed_at` / `contract_signed_by_name` recorded).
  - Then **proceeds to pay** (e.g. “Continue to payment” enabled only when both proposal and contract are signed). Stripe checkout as today.

So: one email, one link, one session; two documents to view and two distinct signature steps before payment.

### 1.3 Data and implementation

- **Template:** Add a React-PDF contract template (e.g. `lib/contract-pdf.tsx`) that renders the Software Agreement with props: `contractDate`, `consultantName`, `consultantAddress`, `clientName`, `clientCompany`, `clientAddress`, `clientCity`, `clientState`, `servicesDescription`, `clientRequirements`, `startDate`, `endDate`, `termType`, `compensationType`, `totalAmount`, `paymentSchedule`, `expenseClause`, etc. Defaults for standard clauses (VII–XIII) can be fixed text; only I–VI need filling.
- **Proposal creation:** In `POST /api/proposals`, after creating the proposal and generating the proposal PDF, call the contract generator with data from the proposal + config, upload contract PDF to Storage, set `proposals.contract_pdf_url`.
- **Schema:** `proposals.contract_pdf_url TEXT`; `proposals.contract_signed_at TIMESTAMPTZ`; `proposals.contract_signed_by_name TEXT`; optionally `proposals.contract_signed_ip TEXT`. Optionally copy `contract_pdf_url` to `client_projects` post-sale for dashboard.
- **Client view:** On `/proposal/[code]`, single page/session that shows:
  - Links to view/download **Proposal** and **Contract**.
  - **Sign proposal** (existing UI) → POST `/api/proposals/[id]/sign`.
  - **Sign contract** (new UI) → POST `/api/proposals/[id]/sign-contract` (or similar) → sets `contract_signed_at`, `contract_signed_by_name`.
  - **Continue to payment** button enabled only when both `signed_at` and `contract_signed_at` are set; proceeds to existing accept/Stripe flow.
- **Accept/payment:** `POST /api/proposals/[id]/accept` should require both proposal signed and contract signed before creating the Stripe session (or return 400 with a message to sign both).

---

## 2. Onboarding plan: Match “ATAS Client Onboarding Plan (Draft)”

### 2.1 Target structure (from reference PDF)

1. **Initial Setup and Access Requirements** — bullet list (e.g. CRM/sales platform access, website/channel integration, data security clearance).
2. **Expected Milestones** — week-by-week (e.g. Week 1: Kickoff; Week 2–3: Customization; Week 4: Testing; … Week 8–12: Post-launch monitoring).
3. **Communication Plan** — e.g. weekly calls, monthly reviews, office hours, ad-hoc (email/Slack).
4. **Win Conditions** — performance metrics, client satisfaction, ROI.
5. **Duration of Warranty Period** — standard period, extended support options.
6. **Artifacts Handoff** — documentation, performance reports, training materials.

The existing **data model** already supports this: `onboarding_plan_templates` and `onboarding_plans` have `setup_requirements`, `milestones_template`/`milestones`, `communication_plan`, `win_conditions`, `warranty`, `artifacts_handoff`. The gap is **PDF layout and copy** so the generated document reads like “ATAS Client Onboarding Plan” with the same section titles and narrative style.

### 2.2 Options: New form vs append to proposal

**Onboarding plan as its own document (current behavior, keep):**
- Post-payment, the system already generates an onboarding plan from templates and produces a PDF. **Do not** make the full onboarding plan a part of the proposal PDF (it’s client-specific and depends on the purchased bundle and template match). Keep it as a **separate document** sent after payment (and after admin approval).

**Append “onboarding preview” to the proposal (optional):**
- In the **proposal PDF**, add a short section such as “Your onboarding” or “What happens after you sign” that summarizes: (1) you’ll receive a detailed Client Onboarding Plan; (2) it will include setup requirements, milestones, communication plan, win conditions, warranty, and artifacts (one short paragraph). Optionally list the **template name** or first 2–3 milestones so the client sees what to expect. This does not require a new form—only extending the proposal PDF with one section populated from the **matched** onboarding template (same resolution as post-sale, but summary only).

**Recommendation:**
- **Keep onboarding plan as a separate PDF** (as today), but **align its content and layout** with the reference “ATAS Client Onboarding Plan (Draft)” (see 2.3).
- **Optionally** add a short “Onboarding preview” section to the proposal PDF for expectation-setting.

### 2.3 Aligning the generated onboarding PDF with the reference

- **Title:** Use “ATAS Client Onboarding Plan” (and optionally “(Draft)” until sent, or drop “(Draft)” once approved).
- **Sections:** Use the same six section titles and order as the reference:
  1. Initial Setup and Access Requirements  
  2. Expected Milestones  
  3. Communication Plan  
  4. Win Conditions for the Project  
  5. Duration of the Warranty Period  
  6. Artifacts Handoff  

- **Content:** Populate from existing template/plan fields. Ensure narrative style matches (short intro per section, bullet lists where appropriate). The current `lib/onboarding-pdf.tsx` already has section structure; adjust section titles and any boilerplate to match the reference. If the reference uses different wording (e.g. “Win Conditions for the Project”), add that as the section heading.
- **Branding:** Use “AmaduTown Advisory Solutions” / “ATAS” and the same tone as the reference (professional, clear).

No new DB fields are required; this is a **PDF template/layout and copy update** in `lib/onboarding-pdf.tsx` (and possibly in onboarding template seed content so default templates follow this structure).

---

## 3. End-to-end flow (updated)

1. **Proposal creation (admin):** Select bundle, value report, implementation strategy (from prior plan). Click “Generate proposal.”
2. **Backend:** Creates proposal; generates **Proposal PDF**; generates **Software Agreement PDF** (contract) from template + proposal data; uploads both; sets `pdf_url` and `contract_pdf_url`. Optionally adds “Onboarding preview” to proposal PDF.
3. **One email:** Admin sends **one email** to the client with the single proposal link (e.g. `https://amadutown.com/proposal/[code]`).
4. **Client — same session:** Client opens the link once. On that page they can:
   - View/download **Proposal** and **Contract** (Software Agreement).
   - **Sign proposal** (name + date) → recorded on proposal.
   - **Sign contract** (name + date) → recorded on proposal (`contract_signed_at`, `contract_signed_by_name`).
   - Click **Continue to payment** (enabled only when both are signed) → redirect to Stripe.
5. **Post-payment:** Client project created; onboarding plan generated (structure aligned with “ATAS Client Onboarding Plan (Draft)”); onboarding PDF generated and stored. After admin approval, client receives **one** onboarding email with link to dashboard and onboarding plan (no separate contract email; contract was already signed in the proposal session).
6. **Client dashboard:** Documents list shows: **Proposal**, **Contract (Software Agreement)**, **Onboarding Plan**, and (from prior plan) **Implementation strategy** if attached.

---

## 3a. Client portal: all signed documents accessible post-payment

**Requirement:** Once the client has paid, **all signed documents** must be **accessible in the client portal** (token-based dashboard at `/client/dashboard/[token]`) so the client can view or download them at any time.

| Document | When available in portal | Notes |
|----------|---------------------------|--------|
| **Signed proposal** | As soon as client project exists (post-payment). | Proposal PDF (with `signed_at` / `signed_by_name`). Fetch via `project.proposal_id` → proposal row → `pdf_url`. Provide signed URL for download/view. |
| **Signed contract (Software Agreement)** | As soon as client project exists (post-payment). | Contract PDF at `proposal.contract_pdf_url` (or `client_projects.contract_pdf_url` if copied). Same signed-URL pattern. Label as “Contract” or “Software Agreement” in the Documents section. |
| **Onboarding plan** | Once the onboarding plan is generated (automatic post-payment) and its PDF is created. | Already linked via `client_projects.onboarding_plan_id` → `onboarding_plans.pdf_url`. Show in Documents section; use signed URL for private storage. |

**Implementation:**

- **Documents section** ([lib/client-dashboard.ts](lib/client-dashboard.ts), [components/client-dashboard/DocumentsSection.tsx](components/client-dashboard/DocumentsSection.tsx)): Build the list from the **project** (not from a broken query). For the project’s `proposal_id`, fetch the single proposal and add: (1) **Proposal** — `pdf_url`, label “Proposal” or “Signed proposal”; (2) **Contract** — `contract_pdf_url`, label “Contract” or “Software Agreement”. For the project’s `onboarding_plan_id`, fetch the onboarding plan and add (3) **Onboarding plan** — `pdf_url`. Optionally add (4) **Implementation strategy** (gamma report PDF) if `gamma_report_id` is set.
- **Signed URLs:** For any PDF in private Storage, generate a short-lived signed URL so the client can open/download from the portal. Display a “View” or “Download PDF” action per document.
- **Order/labels:** Show documents in a clear order (e.g. Contract, Proposal, Onboarding Plan, Implementation strategy) with consistent labels and icons so the client can always find their signed agreement and onboarding plan.

No separate “documents” email is required; the onboarding email can remind the client that all documents are available in the portal.

---

## 3b. Admin preview of all artifacts before email

**Requirement:** Admin must be able to **preview all artifacts** (proposal PDF, contract PDF, onboarding plan PDF, and optionally implementation strategy) **before** they are emailed or otherwise sent to the client. No artifact is sent without the admin having had a chance to review it.

| When | Artifacts to preview | Where |
|------|----------------------|-------|
| **Before sending the proposal link to the client** | Proposal PDF, Contract (Software Agreement) PDF | After "Generate proposal": show "Preview Proposal" and "Preview Contract" that open the PDFs in a new tab or modal. Admin reviews both, then copies/sends the proposal link. |
| **Before sending the onboarding email (Approve & Send)** | Onboarding plan PDF; optionally full set (proposal, contract, onboarding plan) | On Client Projects: for each "Pending onboarding approval" item, add "Preview onboarding plan" that opens the PDF. On project detail, add "Preview all client documents" (links to each PDF). Admin reviews, then "Approve & Send." |

**Implementation:**

- **Proposal/contract preview:** After proposal generation succeeds, show "Preview Proposal (PDF)" and "Preview Contract (PDF)" links (open `pdf_url` and `contract_pdf_url` in new tab; use signed URL if private). Admin reviews before sending the link.
- **Onboarding preview:** On Client Projects list (pending onboarding) and on project detail: add "Preview onboarding plan" and optionally "Preview all client documents" (proposal, contract, onboarding plan) so admin can review before "Approve & Send."
- **Optional:** Single admin view/modal listing all artifacts with "Open PDF" per row before sending onboarding email.

**Summary:** (1) After generating a proposal, admin previews proposal + contract before sending the link. (2) Before Approve & Send onboarding, admin previews onboarding plan (and optionally all documents). No artifact is emailed until admin has previewed.

---

## 4. Implementation summary

| Item | Approach |
|------|----------|
| **Contract** | Separate PDF (“Software Agreement”) generated with proposal; stored at `contract_pdf_url`; **own signature flow** (contract_signed_at, contract_signed_by_name). |
| **Contract template** | New component `lib/contract-pdf.tsx` with sections I–XIII and filled placeholders from proposal + config. |
| **One email** | Admin sends a single email with one proposal link; client accesses and signs everything in one session. |
| **Same session** | One page `/proposal/[code]`: view Proposal + Contract, sign proposal, sign contract, then “Continue to payment” (enabled only when both signed). |
| **Proposal** | Optional: add “Onboarding preview” section; add link to contract PDF. |
| **Onboarding plan PDF** | Align section titles and narrative with “ATAS Client Onboarding Plan (Draft)” in `lib/onboarding-pdf.tsx`. |
| **Schema** | `proposals.contract_pdf_url`, `contract_signed_at`, `contract_signed_by_name` (optional: `contract_signed_ip`); optionally `client_projects.contract_pdf_url`. |
| **Accept guard** | `POST /api/proposals/[id]/accept` requires both proposal signed and contract signed before creating Stripe session. |
| **Client portal — signed documents** | All signed documents (proposal, contract, onboarding plan, and implementation strategy if present) must be accessible in the client portal post-payment: Documents section lists each with view/download (signed URL). Fix proposal fetch (by `project.proposal_id`); add contract and onboarding plan; add implementation strategy if linked. |
| **Admin preview before email** | Before sending the proposal link: admin can preview Proposal PDF and Contract PDF (links after generate, or from proposal context). Before Approve & Send onboarding: admin can preview onboarding plan PDF (and optionally all client documents) from Client Projects list and project detail. |

---

## 5. Files to touch

| Area | Files |
|------|--------|
| Contract template + generator | New: `lib/contract-pdf.tsx` |
| Proposal API | `app/api/proposals/route.ts` — call contract generator, upload, set `contract_pdf_url` |
| Contract signature API | New: `POST /api/proposals/[id]/sign-contract` — set `contract_signed_at`, `contract_signed_by_name` |
| Proposal accept API | `app/api/proposals/[id]/accept/route.ts` — require both `signed_at` and `contract_signed_at` before Stripe |
| Proposal PDF | `lib/proposal-pdf.tsx` — optional “Onboarding preview” section |
| Onboarding PDF | `lib/onboarding-pdf.tsx` — section titles and copy to match reference |
| Migration | Add `proposals.contract_pdf_url`, `contract_signed_at`, `contract_signed_by_name`; optionally `client_projects.contract_pdf_url` |
| Client proposal page | `app/proposal/[code]/page.tsx` — show Proposal + Contract (view/download), Sign proposal, Sign contract, Continue to payment (enabled when both signed) |
| Client dashboard | `lib/client-dashboard.ts`, `components/client-dashboard/DocumentsSection.tsx` — include contract doc type |
| **Admin preview (proposal/contract)** | After proposal generation (ProposalModal or sales page): add "Preview Proposal" and "Preview Contract" links opening `pdf_url` and `contract_pdf_url` (signed URL if needed). |
| **Admin preview (onboarding)** | `app/admin/client-projects/page.tsx` — for pending onboarding items, add "Preview onboarding plan" button; `app/admin/client-projects/[id]/page.tsx` — add "Preview onboarding plan" and optionally "Preview all client documents" in approval area. |
| **Document templates (admin)** | New: `app/admin/document-templates/page.tsx` (or under Configuration); `GET/PATCH /api/admin/document-templates` or site_settings; migration for `document_templates` table or site_settings keys (`proposal_default_terms`, `contract_template`) |
| **Onboarding template edit** | New: `PATCH /api/admin/onboarding-templates/[id]/route.ts`; add Edit action on `app/admin/onboarding-templates/page.tsx` |
| **Contract PDF** | `lib/contract-pdf.tsx` loads contract body from DB/site_settings (not hardcoded) |
| **Layout & brand** | New: `lib/pdf-brand-styles.ts` (or `document-pdf-constants.ts`) — shared header component, brand hex colors, padding/fonts. Use in proposal-pdf, onboarding-pdf, contract-pdf. Add Amadutown logo to `public/` (or document location); use in all three PDF headers. |

**Summary:** Contract is a **separate document with its own signature**; client receives **one email** and completes **view + sign proposal + sign contract + pay** in **one session** on the proposal page.

---

## 6. Admin storage and editing of templates

**Current state:**

| Document | Stored in DB? | Admin UI to view/edit? | Notes |
|----------|----------------|-------------------------|--------|
| **Onboarding plan templates** | Yes — `onboarding_plan_templates` | Yes — **Admin → Post-sale → Onboarding Templates** (`/admin/onboarding-templates`) | List + create (POST). Template content (setup_requirements, milestones_template, communication_plan, win_conditions, warranty, artifacts_handoff) is in DB. There is no `PATCH /api/admin/onboarding-templates/[id]` route, so **editing** an existing template is not implemented in the API; admins can create new templates and rely on seed SQL for initial content. PDF layout/styling is in `lib/onboarding-pdf.tsx` (code). |
| **Proposal** | No | No | Default terms live in code (`getDefaultTerms()` in `app/api/proposals/route.ts`). Per-proposal `terms_text` can be set when creating a proposal but there is no admin "proposal template" page. PDF layout is in `lib/proposal-pdf.tsx`. |
| **Contract (Software Agreement)** | No (not built) | No | Plan assumes a code-based template in `lib/contract-pdf.tsx` with fixed clause text. No DB storage or admin UI for contract body. |

**Recommendation — single place for all document templates:**

Add (or extend) an admin area so **all** of these templates can be stored and modified without code deploys:

1. **Contract template**  
   - Store the Software Agreement **body** (sections I–XIII text, possibly with placeholders like `{{client_name}}`, `{{total_amount}}`) in the DB.  
   - Options: **site_settings** (e.g. key `contract_template` with JSONB for sections) or a **document_templates** table (e.g. `template_type: 'contract'`, `body` or per-section fields).  
   - Admin page: e.g. **Admin → Configuration → Document templates** (or **Proposal & contract templates**) with a form to edit contract clause text. The contract PDF generator would **read from DB** (or site_settings) instead of hardcoded strings.

2. **Proposal default terms**  
   - Store default proposal terms in DB (e.g. site_settings key `proposal_default_terms` or a row in document_templates).  
   - Admin page: same "Document templates" (or Configuration) section; one text area or rich editor for default terms. `POST /api/proposals` would use this when `terms_text` is not provided.

3. **Onboarding templates**  
   - Already in DB with admin UI. Ensure **edit** is supported: add `PATCH /api/admin/onboarding-templates/[id]` and an Edit action on the onboarding templates page so admins can change existing template content (sections, milestones, etc.) without SQL.  
   - Optionally add a link from the new "Document templates" hub to **Onboarding Templates** so all template-related admin lives under one conceptual area (e.g. Configuration → Document templates → Onboarding templates, or a "Templates" parent with Proposal terms, Contract, Onboarding).

**Suggested implementation (for the plan):**

- **New:** `document_templates` table (or use `site_settings`) for:
  - `proposal_default_terms` (text)
  - `contract_template` (JSONB: sections I–XIII with placeholder-aware text)
- **New:** Admin page **Document templates** (or **Proposal & contract templates**) at e.g. `/admin/document-templates` or under Configuration: edit proposal default terms, edit contract template body.
- **New:** `GET /api/admin/document-templates` and `PATCH /api/admin/document-templates` (or per-key site_settings) for the UI.
- **Contract PDF:** `lib/contract-pdf.tsx` loads contract body from DB/site_settings and fills placeholders from proposal/session.
- **Proposal API:** When creating a proposal, if `terms_text` is not provided, load default from DB (fallback to current `getDefaultTerms()` in code).
- **Onboarding:** Add `PATCH /api/admin/onboarding-templates/[id]` and Edit in the onboarding templates UI so existing templates can be modified.

---

## 7. Layout and brand consistency across templates

All generated document PDFs (proposal, contract, onboarding plan) must share a **consistent layout** and **AmaduTown brand** (logo + colors). Canonical source: [app/globals.css](app/globals.css) and [tailwind.config.ts](tailwind.config.ts); see [docs/design/amadutown-color-palette-audit.md](docs/design/amadutown-color-palette-audit.md).

### 7.1 Shared layout

- **Header (every page):** Same structure on all three documents:
  - **Logo:** AmaduTown logo image (left or center). If the logo lives in `public/` (e.g. `public/logo.svg` or `public/amadutown-logo.png`), reference it in React-PDF via a URL (absolute for server-side PDF generation, e.g. `process.env.NEXT_PUBLIC_BASE_URL + '/logo.svg'` or a known path). If no logo asset exists yet, add a placeholder and document in the plan that the asset must be added; the layout reserves space for it.
  - **Company name:** “AmaduTown Advisory Solutions” (or “ATAS”) in brand typography/weight.
  - **Document title:** e.g. “Proposal”, “Software Development Agreement”, “Client Onboarding Plan” — consistent font size and position.
- **Page:** Same padding (e.g. 40pt), same base font (Helvetica or a brand font if registered in React-PDF), same margin bottom for footer/continuation.
- **Sections:** Same pattern for section titles (e.g. uppercase, letter-spacing, brand accent color) and dividers across proposal, contract, and onboarding PDFs.
- **Body text / tables:** Neutral text and table styling use brand neutrals (see below), not generic gray/blue.

Implement by:
- **Shared styles module:** Create a small shared module (e.g. `lib/pdf-brand-styles.ts` or `lib/document-pdf-constants.ts`) that exports brand colors (hex), padding, font sizes, and a reusable **header component** (or shared style object) used by `lib/proposal-pdf.tsx`, `lib/contract-pdf.tsx`, and `lib/onboarding-pdf.tsx`. All three PDFs import the same header layout and color set so changes in one place apply everywhere.

### 7.2 AmaduTown brand colors (for PDFs)

Use these in all document PDFs (replace current blue `#2563eb` and grays with):

| Token | Hex | Use in PDFs |
|-------|-----|-------------|
| Imperial navy | `#121E31` | Header background (optional), strong text, section backgrounds |
| Radiant gold | `#D4AF37` | Company name, section titles, dividers, accents, CTAs |
| Silicon slate | `#2C3E50` | Secondary text, borders |
| Platinum white | `#EAECEE` | Body text on dark, or use for “white” areas |
| Bronze | `#8B6914` | Darker gold accent, underlines |
| Gold light | `#F5D060` | Highlights, optional gradient with radiant-gold |

**Concrete changes:**
- **Proposal PDF** ([lib/proposal-pdf.tsx](lib/proposal-pdf.tsx)): Replace `companyName` color `#2563eb` with `#D4AF37` (radiant-gold). Replace gray neutrals: e.g. `#1a1a1a` → `#121E31` or `#2C3E50` for text, `#e5e7eb` / `#f3f4f6` → silicon-slate or platinum-white for borders/backgrounds. Add logo to header (see 7.1).
- **Onboarding PDF** ([lib/onboarding-pdf.tsx](lib/onboarding-pdf.tsx)): Same — replace `#2563eb` with `#D4AF37` for company name, section numbers, thick divider; use navy/slate/platinum for text and backgrounds. Add logo to header.
- **Contract PDF** (new `lib/contract-pdf.tsx`): Use the shared header (logo + “AmaduTown Advisory Solutions” + “Software Development Agreement”) and the same color set from day one. No blue or off-palette grays.

### 7.3 Logo asset

- **Where:** Prefer a single logo asset in `public/` (e.g. `public/amadutown-logo.svg` or `.png`) so it can be referenced by URL in React-PDF’s `Image` component. If the project uses a different path (e.g. design-files or asset bucket), document it and use that URL for PDF generation.
- **Format:** SVG or PNG with transparent background recommended for header use. For React-PDF, ensure the URL is reachable from the server (e.g. same origin or a known CDN).
- **Placeholder:** If no logo exists at implementation time, use a text-only header (“AmaduTown Advisory Solutions”) and leave a comment + plan note to add the image once the asset is available; layout should reserve space so adding the logo later does not shift content.

### 7.4 Summary

- **Layout:** One shared header (logo + company name + document title), same padding and section pattern across proposal, contract, and onboarding PDFs; implement via shared styles/header module.
- **Logo:** AmaduTown logo in header of all three; asset in `public/` (or documented location); placeholder acceptable until asset is added.
- **Colors:** All PDFs use AmaduTown palette only (imperial-navy, radiant-gold, silicon-slate, platinum-white, bronze, gold-light); remove blue and non-brand grays from proposal and onboarding PDFs; contract PDF uses brand from the start.
