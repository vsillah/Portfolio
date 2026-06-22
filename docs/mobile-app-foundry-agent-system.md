# Mobile App Foundry Agent System

## Purpose

The Mobile App Foundry turns app ideas into a governed pipeline: market signal, app-fit analysis, prototype build, tester readiness, and commercialization review.

The first source method is Adam Lyttle's YouTube video, `My $1.19M App Process: App Idea & Validation (Part 1 of 3)`, supplied by Vambah on June 19, 2026:

- `https://youtu.be/yBa3BKOrVPA?si=QfNu_KvZ_1e9Wu3y`

The video is an input to the validation rubric. It is not copied into public Portfolio content. Raw transcript notes, private GitHub inventory, and unapproved market research should stay local-first or in Open Brain source records until a sanitized opportunity is approved.

## Public Surface

- Public placement: the existing `Mobile App Generation` service card in the Services catalog.
- Public routes: homepage `#services`, `/services`, and the relevant service detail page.
- Admin route: `/admin/mobile-app-foundry`
- Supporting data: `lib/mobile-app-foundry.ts`

The public surface should say that AmaduTown can build branded mobile applications and move from concept to prototype and release readiness. It should not expose source videos, validation methods, private repo names, raw trend scraping, private app ideas, GitHub account details, credentials, tester emails, or store-console evidence.

## Agent Roles

| Agent | Role | Responsibility |
| --- | --- | --- |
| Amina (Zazzau) | Trend Strategist | Finds demand signals and ranks app opportunities. |
| Imhotep (Kemet) | Prototype Architect | Turns approved ideas into scoped prototype build plans and repos. |
| Kandake (Kush) | Commercialization Captain | Prepares tester, pricing, release, and submission plans after review. |
| Shaka (Zulu) | Chief of Staff | Routes approvals, resolves conflicts, and keeps the work inside Agent Ops. |

## Input Sources

### Public and semi-public trend inputs

- App Store category rank movement and competitor metadata.
- Google Trends and web search demand.
- TikTok, YouTube, Reddit, Product Hunt, Indie Hackers, and creator-build signals.
- Keyword demand from ASO/SEO tools where available.
- Competitor pricing, subscription models, review complaints, and screenshot positioning.

### Vambah app-fit inputs

- Authenticated GitHub inventory for Vambah-owned repos.
- Public Portfolio product, service, and prototype data.
- Open Brain memories and approved summaries about prior app work.
- Prior release evidence, tester evidence, and commercialization notes.

Private repo names and raw repo metadata should not be written into public tracked files by default. Use a local derived profile such as:

- common app jobs,
- preferred build stack,
- reusable UI/backend patterns,
- release maturity,
- recurring audiences,
- commercialization fit.

## Popularity Score

Score each opportunity out of 100.

| Factor | Weight | Evidence |
| --- | ---: | --- |
| Demand signal | 25 | App Store rank/category movement, keyword demand, search and creator trend volume. |
| Monetization path | 20 | Subscription or paid-app precedent, clear upgrade trigger, willingness to pay. |
| Builder fit | 20 | Matches prior app themes, fits AmaduTown offer ladder, can reuse known implementation patterns. |
| Build velocity | 15 | MVP can ship quickly, low platform risk, limited dependency on unavailable data. |
| Differentiation | 10 | Clear twist on a proven category, specific audience wedge, operational or AI advantage. |
| Release readiness | 10 | Tester path is clear, privacy burden is manageable, store-policy risk is understood. |

Apply penalties for:

- regulated medical, financial, child-safety, or legal claims without controls,
- high privacy burden,
- unclear data rights,
- heavy platform lock-in,
- saturated category with weak differentiation,
- app store rejection risk,
- unclear path to testers or payment.

## Backlog Record Shape

Each proposed app should produce a structured record:

```json
{
  "id": "app-opportunity-slug",
  "title": "Opportunity title",
  "audience": "Primary user",
  "job_to_be_done": "The concrete job the app helps complete",
  "trend_sources": [],
  "competitors": [],
  "popularity_score": 0,
  "score_breakdown": {
    "demand_signal": 0,
    "monetization_path": 0,
    "builder_fit": 0,
    "build_velocity": 0,
    "differentiation": 0,
    "release_readiness": 0
  },
  "vambah_fit_summary": "Public-safe pattern match, not private repo detail",
  "prototype_scope": [],
  "commercialization_path": [],
  "risks": [],
  "human_gate": "review_required"
}
```

## Workflow

1. Amina ingests the source video method, current trend evidence, and the private app-fit profile.
2. Amina writes a ranked backlog with evidence and confidence.
3. Shaka routes the top opportunities for human review.
4. Imhotep creates prototype work items only after approval.
5. Prototype builders create named GitHub repos or branches, with secrets and account setup gated.
6. Kandake prepares commercialization roadmaps only for validated prototypes.
7. Vambah approves tester outreach, store submission, payment setup, public launch, or client-facing claims.

## Human-In-The-Loop Gates

Approval is required before:

- creating a new GitHub account,
- creating repos under a new owner or organization,
- using paid APIs or paid store/developer accounts,
- inviting testers,
- submitting to App Store Connect or Google Play,
- publishing public claims,
- collecting user data,
- setting price, subscription, or payment terms,
- turning a prototype into a client or public offer.

## Agent Ops Integration

Use existing Agent Ops patterns:

- Proposed app ideas should become `agent_work_items` only after explicit confirmation.
- Work items should stay `proposed` until Vambah or Shaka approves delegation.
- Prototype work uses named branches or named repos and stops at PR-ready state unless merge authority is explicitly delegated.
- Commercialization uses approval packets with risk, validation, rollback, pricing, tester, and store-submission notes.
- Do not create a separate Mobile Foundry backlog, standup room, Kanban board, run console, or approval queue. Mobile Foundry can prepare packets and proposed work items, but live execution state belongs in the existing Agent Ops surfaces: Mission Control, Decision Queue, Agent Kanban, Standup Room, and Run Console.
- The Mobile Foundry admin page may summarize gate status at a glance, but authorization links should route to the central Decision Queue or filtered Run Console. The actual approve/reject controls stay on the Agent Ops run detail where evidence, risk, rollback, and approval metadata are attached.
- Admin Mobile Foundry lists that can grow should use pagination, filtering, or collapsed detail rows instead of long stacked sections.

## Roadmap

### Phase 1: Section and control surface

- Keep public Mobile App Generation content under the existing Services catalog.
- Add the admin Mobile App Foundry surface as the private operating map behind the service.
- Keep the first rubric source and scoring contract in tracked code.

### Phase 2: Read-only analyst

- Script: `npm run --silent mobile-foundry:analyze -- --input <path> [--output <path>]`.
- Input: JSON source packet, GitHub inventory summary, market evidence, and optional Open Brain context.
- Output: ranked backlog JSON with `mode: "read_only"` and safety flags proving no work items, repositories, GitHub accounts, outbound messages, store submissions, or pricing changes were created.
- The default path prints JSON to stdout. Use `--output` only when a local artifact is explicitly needed.

### Phase 3: Approval-backed backlog

- Add an admin action to convert selected app ideas into proposed Agent Ops work items.
- Add dedupe keys by app slug and source run.
- Endpoint: `POST /api/admin/mobile-app-foundry/work-items`.
- Preview mode is the default when `create_work_items` is not set.
- Creation requires `confirmation: "create_mobile_foundry_work_items"`.
- The only Phase 3 side effect is a proposed `agent_work_items` record owned by `engineering-copilot` with Imhotep recorded as the Mobile Foundry prototype role. Repos, GitHub accounts, paid APIs, tester outreach, store submissions, price changes, user-data collection, and public/client-facing claims remain separate approval gates.

### Phase 4: Prototype build lane

- Add a prototype packet format for new repo creation, build scope, smoke tests, and demo evidence.
- Keep GitHub account creation and store credentials as explicit HITL gates.
- Script: `npm run --silent mobile-foundry:prototype-packet -- --input <path> [--format json|markdown] [--output <path>]`.
- Admin preview route: `POST /api/admin/mobile-app-foundry/prototype-packet`.
- Input may be a backlog record or `{ "backlog_record": ... }`.
- Output includes app brief, recommended stack, proposed repo slug, suggested branch, MVP scope, build milestones, smoke tests, demo evidence, commercialization assumptions, risks, and approval gates.
- The packet is read-only. It does not create repositories, GitHub accounts, paid API usage, tester invitations, store submissions, price changes, public claims, or user-data collection.

### Phase 5: Commercialization lane

- Add tester packets, pricing notes, store-readiness checks, privacy checklists, and public Portfolio launch criteria.
- Require Vambah approval before outreach or submission.
- Script: `npm run --silent mobile-foundry:commercialization-packet -- --input <path> [--format json|markdown] [--output <path>]`.
- Admin preview route: `POST /api/admin/mobile-app-foundry/commercialization-packet`.
- Input may be a backlog record or `{ "backlog_record": ..., "commercialization_input": ... }`.
- Optional validation fields include `validation_status`, `prototype_url`, `demo_evidence`, `tester_profile`, `privacy_notes`, `pricing_notes`, `store_notes`, and `launch_notes`.
- Output includes tester packet, pricing notes, privacy checklist, store-readiness checks, public launch criteria, commercialization path, demo evidence, risks, and approval gates.
- The packet is read-only. It does not invite testers, create tester lists, collect user data, submit to app stores, change pricing, create payment products, publish public claims, or send outbound messages.
