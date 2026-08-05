# Agentified YouTube and X calendar integration brief

Date: 2026-08-05
Status: dedicated lane brief and implementation backlog
Owner: Amina (Strategic Narrative)
Campaign: `agentified-trust-scale-2026-07`
Template: `whisper_to_shout`

## Boundary

This brief extends the approved Agentified content calendar into YouTube and X planning. It does not publish, schedule, upload, render, send outreach, or change provider settings.

Allowed:

- research public YouTube and X creator patterns;
- create internal content backlog rows;
- prepare X posts, threads, YouTube scripts, B-roll plans, titles, descriptions, and metadata for review;
- attach source pattern, source-distance, originality, rights, and privacy notes.

Not allowed:

- copying another creator's post, thread, title, thumbnail, visual identity, or catchphrase;
- generating provider assets without the separate render gate;
- uploading or publishing to YouTube or X;
- scheduling external posts;
- treating the connected provider path as publication approval.

## Current implementation inventory

Portfolio already supports `x` and long-form `youtube` as calendar/intelligence channels in:

- `lib/social-content-calendar.ts`
- `lib/social-content-intelligence.ts`

The remaining product gap was that generated channel review drafts did not include X, and the Agentified launch packet did not carry X or long-form YouTube rows. This brief pairs with the implementation change that:

- adds X to the prepared social-channel review draft batch;
- adds one long-form YouTube pilot row;
- adds four X rows aligned to the `tease`, `teach`, `proof`, and `offer` phases;
- keeps the existing backward-relative scheduler anchored to the final shout release moment.

## Campaign calendar model

The Agentified launch calendar should stay one campaign, not separate LinkedIn, YouTube, and X campaigns.

The sequence now works backward from the final shout row:

| Phase | Channel role | Calendar job |
| --- | --- | --- |
| Tease | LinkedIn + X | Name the speed-versus-trust tension and invite operators into the problem. |
| Teach | LinkedIn + X + YouTube Shorts + YouTube long form | Teach AMINA and the receipt operating layer. |
| Proof | LinkedIn + X + YouTube Shorts | Show the cover, workbook, and operating proof without exposing private records. |
| Offer | LinkedIn + page/creative placeholder + X | Make the release path clear and point to `/agentified`. |

The long-form YouTube pilot is `AGT-YT-EP01`, "The Receipt Every Agent Needs." It belongs in the same calendar as the existing Shorts so the YouTube lane can carry both short-form cutdowns and deeper proof content.

## Amina X research loop

Amina should run the X research process the same way she ran the YouTube lane: pattern-first, source-safe, original output only.

Research targets should be selected from these comparable persona groups:

- AI product operators explaining workflow and governance;
- agent-builder educators translating technical shifts into practical operating rules;
- product leadership writers using threads to teach one durable framework;
- creator-founders launching a book, course, or operating system through a thread sequence;
- builders who pair short claims with visible proof artifacts, screenshots, demos, or receipts.

For each source candidate, Amina records:

- creator/persona category;
- public URL and retrieval date;
- visible engagement signals when available;
- outlier rationale, such as stronger-than-usual replies, reposts, saves, view-to-follower performance, or visible conversation quality;
- transferable pattern: hook type, topic frame, post/thread structure, CTA shape, cadence, proof style, visual grammar;
- originality boundary: what must not be copied;
- Agentified adaptation: how the pattern becomes Portfolio/AmaduTown-specific.

If live X metrics are unavailable or gated, Amina can use manual public review and mark the evidence as directional. Do not infer private analytics.

## Transferable X patterns to test

Use these as hypotheses, not finished copy:

| Pattern | Agentified adaptation |
| --- | --- |
| Tension-first single post | "AI got faster. Trust did not." Use as a compact entry point into the campaign. |
| Mini-thread framework | Break AMINA into five practical moves with one operating question per reply. |
| Proof artifact thread | Show how a receipt, gate, or workbook page changes the approval conversation. |
| Build-in-public decision note | Explain one design decision from Portfolio or Agentified without exposing private records. |
| Release thread | Use final shout date to connect problem, framework, proof, and CTA in one concise sequence. |

## Backlog

| Priority | Owner lane | Work item | Scope | Acceptance criteria |
| --- | --- | --- | --- | --- |
| P0 | Amina | Run X persona/outlier research | Collect public X examples across the comparable persona groups and score transferable patterns. | At least 8 public X examples are recorded with URL, pattern, fit, source-distance boundary, and directional engagement rationale. |
| P0 | Amina | Generate Agentified X phase backlog | Draft internal X post/thread packets for `AGT-X-01` through `AGT-X-04`. | Each packet has phase, hook, post text, optional thread, CTA, source pattern, originality note, and human review state. |
| P0 | Shaka | Keep YouTube and X in one campaign calendar | Use `agentified/campaign/portfolio-campaign-packet.json` as the shared source. | Calendar import reports 17 Agentified rows and supported channels include `linkedin`, `x`, `youtube_shorts`, `youtube`, and `thumbnail`. |
| P1 | Piye | Ensure X review drafts are generated | Include X in channel review draft preparation and tests. | Preparing channel drafts marks the X lane `in_review` with post/thread fields and no external side effects. |
| P1 | Yaa Asantewaa | Preserve relative final-shout sequencing | Keep all Agentified rows recalculated backward from the final shout row. | Calendar metadata includes `schedule_mode: relative_to_final_shout`, final asset `AGT-X-04`, and previous/next asset links. |
| P1 | Moremi | Review X source-distance and rights/privacy | Check X sources, proof references, and CTA language before human review. | Packets do not copy creator language, visual identity, private data, or unsupported claims. |
| P2 | Hannibal | Repurpose YouTube proof into X companion posts | Use Episode 1 and Shorts as source material for X support posts. | Each YouTube item has at least one X companion angle that points back to the same campaign phase. |

## Human gates

The following remain human-gated:

- final X copy/thread approval;
- X provider/API setup;
- X external post or schedule;
- YouTube render approval;
- YouTube upload or publish;
- campaign calendar date changes after final-shout recalculation;
- any provider settings, credentials, or production configuration.

## Review standard

Before any X or YouTube item can move toward provider handoff, the packet must show:

- campaign phase and calendar row;
- approved source basis;
- public pattern used;
- originality/source-distance note;
- Vambah voice/humanizer pass;
- privacy and rights notes;
- exact next action;
- whether the next action waits on Vambah.

The user should be able to open the Agentified calendar and see YouTube and X as parts of the same campaign sequence, not as separate side quests.
