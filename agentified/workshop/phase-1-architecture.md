# Agentified workshop: source and curriculum architecture

Status: Phase 1 proposal. No learner course, agent run, media, database record, or publication is created by this package. The machine-readable bindings are [`source-register.json`](source-register.json) and [`curriculum-crosswalk.json`](curriculum-crosswalk.json). The register records the exact SHA-256 of each repository source at base commit `296eeed3242c4c0f6874baffbb02edcd76c76ef2`; changing a canonical source requires an explicit rebind and review.

## Source decision

The production draft and its 26 chapter files are the narrative source. The companion operating system workbook supplies the named outputs. The enhanced workbook is a review draft, so a lesson may consult it but should not silently substitute it for the companion workbook. The blueprint supplies act structure and intent. The visual source map governs visual attribution and asset status. The public `/agentified` page is an existing book route and remains intact.

Source classification is conservative. Manuscript, workbook, prompts, and internal Portfolio examples may inform scripts, but a script writer must paraphrase and clear each example for learners. The source register does not grant redistribution rights. The local AmaduTown Drive search found the original `Accelerated_infographic.png` at the path recorded by the visual source map. It did not establish a separate approved Agentified workshop asset set. Its SAM lineage may be explained; reuse of the image in a lesson needs a rights and design review. The A.M.I.N.A. publication plate specifically carries a fresh review flag in the source map. Cover review comps are author review material. The route currently displays `/agentified-cover.jpg`, while the visual source map names the SVG as the current public cover; Phase 2 should resolve that discrepancy before selecting workshop artwork.

## Curriculum contract

`curriculum-crosswalk.json` is the authoritative 16-lesson plan. It covers chapters 1–26 exactly once and groups lessons 1–5 in The Harness, 6–10 in Authority, 11–15 in The Agentified Organization, and 16 in synthesis and capstone. Each lesson records its exact chapter paths, workbook outputs, learning outcome, exercise, Operating File artifact, visual candidates, and evidence boundary. A lesson's visual candidate is a review reference, not an approved embed.

The thread through the course is one real *type* of workflow chosen by the learner, such as preparing a weekly research brief. During the workshop, the learner writes a bounded design for that workflow using invented or redacted examples. They can later apply the design in their own organization after their local review. The workshop never asks learners to paste private source material, credentials, customer records, or a live agent trace.

## Proposed Agentified Operating File

One learner-owned file should persist across the lessons. The proposed version is `agentified-operating-file/v1`, with `workflow_id` as an opaque local identifier and `revision` as a monotonic integer. Its sections are:

| Section | Required fields | First lesson | Review rule |
| --- | --- | ---: | --- |
| `workflow` | job, human outcome, decision owner, scope, excluded actions | 1–2 | Owner and exclusion must be explicit. |
| `sources` | source IDs, classification, permitted use, attribution, retention | 3 | References only; no raw private data. |
| `receipt` | event ID shape, input/output references, artifact owner, timestamp, cost, rollback note | 1, 3 | This is a template, not a live trace. |
| `memory` | source, event, proposal, approval state, expiry | 4 | A proposal cannot become approved memory by itself. |
| `routing` | controller role, fallback human, tool/action boundary | 4–5 | No executable endpoint or credential. |
| `authority` | read/write/recommend/spend permissions, approver, gate, expiry, revocation | 6–10 | Default action is hold; each side effect needs a named human gate. |
| `team` | roles, RACI-style owner, handoff contract, failure path | 7–8 | A role cannot approve its own expansion. |
| `evaluation` | synthetic cases, expected result, observed result, failure threshold | 8–9 | Classroom pass cannot grant production authority. |
| `operations` | metrics, cockpit status, blocker, unblock route, budget ceiling | 9–11 | Examples use synthetic numbers and states. |
| `proof` | redaction decision, audience, claim, evidence references, limitations | 12–14 | Public claim requires independent source and privacy review. |
| `research` | hypothesis, experiment trace shape, metric, proposal, disposition | 13 | No autonomous promotion or provider call. |
| `day_and_audit` | six-beat rehearsal, unresolved gaps, keep/shrink/retire decision | 15–16 | Human disposition and date required; blank means pending. |

Every section carries `status` (`blank`, `draft`, `needs_review`, `approved_for_local_use`), `updated_at`, and `evidence_refs` with opaque local IDs. `approved_for_local_use` means the learner reviewed a *plan*; it is not a course-issued permission to run agents. The file should serialize as portable JSON plus an accessible human-readable view. Exports should omit raw inputs by default and show missing fields rather than inventing answers. Storage, identity, deletion, and portability need separate Phase 3 design; this phase proposes no database table or migration.

## Route and system decisions

| Route | Decision | Shared system | Agentified boundary |
| --- | --- | --- | --- |
| `/agentified` | Keep the current book/publication page unchanged in Phase 1. Later add a reviewed course entry point. | Existing site navigation, publication conventions, cover handling. | Book claims and cover remain authoritative; course copy needs its own editorial approval. |
| `/agentified/learningplan` | Proposed 16-lesson course route. No implementation in this phase. | Accelerated's lesson shell, responsive layout, progress and member access patterns may be adapted after review. | New chapter bindings, A.M.I.N.A./SAM framing, evidence boundaries, scripts, visuals, and completion criteria. No Accelerated content or completion identity reuse. |
| `/agentified/operating-file` | Proposed working-file route for the same 16 lessons. No implementation in this phase. | Accelerated Decision File's save/export, navigation, and accessible form patterns are candidates for extraction. | Agentified schema, authority gates, receipts, memory proposals, spend limits, proof rules, and a distinct version namespace. |

The Accelerated routes currently wrap `AcceleratedLearningPlan`, and its Decision File is a mode of that component. Phase 3 should extract generic presentation and persistence primitives only after an interface review; copying the component with its `accelerated_*` API, tables, credential, or completion semantics would bind the new course to the wrong domain. The existing `/member/dashboard` can eventually show Agentified enrollment and progress through a course-typed adapter, but Agentified progress must have a distinct course key and completion record. This is an architecture proposal, not authorization for schema or authentication changes.

## Phase 2 script acceptance gate

1. Sixteen scripts use the crosswalk's lesson IDs, chapter sources, workbook outputs, and one continuous example workflow. Every chapter is represented in its assigned lesson, including the final accountability chapter.
2. Each script starts with a concrete operator situation, states one learner outcome, walks the exercise, and ends with a named Operating File update and a useful stop condition. A.M.I.N.A. and SAM keep their source meanings.
3. Each demonstration uses synthetic or explicitly cleared public material. No internal trace, private corpus excerpt, credential, client detail, or unapproved inference enters learner copy.
4. Any visual named in a script has a register binding, attribution note, legibility check, and explicit author/rights approval before media production. The A.M.I.N.A. plate and cover selection are held pending their review.
5. An editor checks the scripts against the canonical chapters and workbook, reads them aloud, and removes formulaic AI phrasing. A source reviewer signs off claims and boundaries. Scripts remain drafts until both reviews pass.
6. A script packet includes lesson timing, narration, on-screen text, exercise prompt, output example, visual cue, accessibility notes, and the exact source IDs. It contains no provider-ready secret or automatic execution instruction.

## Finite downstream roadmap

| Phase | Output | Exit gate |
| --- | --- | --- |
| 1. Source and architecture | This register, crosswalk, Operating File proposal, route decisions, and validator | Draft PR passes source validation and captain review. |
| 2. Scripts | Sixteen reviewed lesson packets | Editorial, source, privacy, and visual candidate decisions pass. |
| 3. Course foundation | Agentified routes and distinct member/Operating File model | Architecture and data-boundary review, focused tests, responsive captain QA. Any migration follows its separate gate. |
| 4. Media and integration | Approved lesson media and course UI wired to real progress | Asset rights, playable media, accessibility, full workflow test, preview QA. |
| 5. Release | Human QA, merge, deployment, and production smoke | Client-facing MP4 handoff, explicit Human QA and applicable release approvals, both Vercel contexts checked. |

Current status: Phase 1 of 5. Four phases remain after this draft PR is accepted. Phase 2 can begin from the validated bindings; visual approval, cover choice, and any use of internal Portfolio examples remain decision gates.
