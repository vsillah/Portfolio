# Agentified workbook enhancement review

Status: ready for author and Fable 5 expansion pass

Date: 2026-07-02

## What changed

This pass adds a workbook layer to `Agentified` so the book is no longer only a story about Sam discovering agentic operating-system principles. It now gives the reader concrete artifacts they can adapt into their own authentic operating system.

The governing acronym is now A.M.I.N.A. In the story, Sam finds Amina as an agentic co-worker. In the workbook, A.M.I.N.A. is the repeatable operating process:

- Align the work
- Map the authority
- Instrument the receipt
- Negotiate the gate
- Audit the outcome

Created files:

- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook/agentified-operating-system-workbook.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook/worksheet-insertion-plan.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/youtube-ai-source-map.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/formal-endnotes.md`
- `/Users/vambahsillah/Projects/Portfolio/agentified/scripts/assemble-workbook-enhanced-draft.sh`

The enhanced draft keeps the production manuscript intact and adds a recurring chapter-end section:

```text
Build your operating system
```

Each section gives the reader:

- an operating artifact
- the Portfolio pattern behind it
- a practical use case
- builder prompts
- a copy/paste AI prompt
- a keep condition
- a red flag

## Portfolio guidance used

The workbook layer borrows structure from Portfolio's actual operating-system patterns without asking readers to copy Portfolio itself:

- Agent Ops trace records, artifacts, approvals, handoffs, work items, and costs
- Shaka as a controller/router pattern
- Open Brain source, event, proposal, memory, link, and projection records
- Mission Control as the main cockpit
- Slack as the mobile unblock lane
- approval gates before mutation
- payment and spend authority gates
- client-safe governance exports
- Mobile App Foundry scoring and approval packets
- Model Ops AutoResearch proposal gates

## Structural validation

Validation passed:

- 26 chapters in the workbook-enhanced draft
- 27 `Build your operating system` sections, including the safety-note starter map
- 3 acts
- 2 appendices
- 41,468 words in the workbook-enhanced draft
- 5,131 words in the companion workbook
- no flagged scaffolding phrases from earlier Fable/Claude passes
- no flagged AI-ish filler terms from the humanizer pass
- no smart punctuation introduced in the new workbook files

The A.M.I.N.A. decision is now reflected in:

- the workbook-enhanced draft front matter
- the companion workbook
- the worksheet insertion plan
- the next Fable 5 revision prompt

The YouTube attribution decision is now formal endnotes. The internal source map stays available for traceability, and the public-facing notes live in:

- `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/formal-endnotes.md`

Commands run:

```bash
rg -n '^## Chapter [0-9]+:' manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md | wc -l
rg -n '^### Build your operating system' manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md | wc -l
rg -n '^# Act ' manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md | wc -l
rg -n '^# Appendix:' manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md | wc -l
# scaffolding-pattern scan against prior Fable/Claude artifacts
# humanizer phrase scan against common AI-ish filler
# smart punctuation scan against new workbook files
wc -w manuscript/production-draft/agentified-production-draft.md manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md manuscript/workbook/agentified-operating-system-workbook.md manuscript/workbook/worksheet-insertion-plan.md
```

## Recommended next pass

Use Fable 5 or Claude Code to expand the workbook feel in three focused moves.

1. Expand examples inside each chapter.
   - Add 1 to 2 concrete operator examples per chapter.
   - Keep examples human, practical, and tied to the Sam story.
   - Avoid inventing unrealistic agent autonomy.

2. Deepen the worksheet artifacts.
   - Turn compact chapter-end blocks into richer pages where needed.
   - Keep the companion workbook as the full template library.
   - Preserve blank spaces, checklists, tables, and copy/paste prompts.

3. Strengthen the authenticity frame.
   - Emphasize that readers should build their own operating system around their work, risk, people, approval lines, and values.
   - Portfolio is proof of pattern, not a product to clone.
   - The moral center remains: agents prepare, humans approve consequences.

## Prompt for the next Fable 5 pass

```text
You are revising Agentified into a stronger hybrid narrative/workbook manuscript.

Use these files:
- /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md
- /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook/agentified-operating-system-workbook.md
- /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook/worksheet-insertion-plan.md
- /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/youtube-ai-source-map.md
- /Users/vambahsillah/Projects/Portfolio/agentified/manuscript/references/formal-endnotes.md

Goal:
Make the book feel more useful and ownable for the reader. It should still read like a story, but each chapter should leave the reader with an artifact they can actually build.

Core story device:
Sam finds Amina, an agentic co-worker who teaches him that acceleration without operating discipline creates risk. Amina should appear as a co-worker and teaching presence in the scenes, instead of sitting in the manuscript as a named tool.

Core operating process:
A.M.I.N.A.
- Align the work: name the outcome, the human stake, and the decision being prepared.
- Map the authority: define what the agent can read, write, remember, recommend, spend, or route.
- Instrument the receipt: require trace, source, artifact, owner, cost, approval state, and rollback path.
- Negotiate the gate: decide what needs human approval before the agent can move forward.
- Audit the outcome: review what happened, what changed, what was learned, and whether authority should expand or shrink.

Revision rules:
- Preserve the Sam narrative spine.
- Make Amina the agentic co-worker who helps Sam uncover the process.
- Use A.M.I.N.A. as the reader-facing worksheet spine.
- Use the YouTube source map for attribution and the formal endnotes file for public citation format. Attribute concepts to the right creators and videos where it strengthens the book. Do not dump every source into the prose.
- Preserve the safety principle: agents prepare, humans approve consequences.
- Do not make Portfolio the product being sold. Use Portfolio as structural proof.
- Treat Portfolio as the proof environment and the YouTube videos as learning inputs.
- Expand concrete examples readers can adapt to their own operating system.
- Add worksheet texture: checklists, prompts, fields, artifact templates, reflection questions, and practical examples.
- Keep Vambah's voice grounded, practical, morally clear, and systems-minded.
- Avoid generic AI hype, corporate filler, and over-polished consultant language.
- Do not use private-source details or raw internal records.

For each chapter:
1. Identify the main operating principle.
2. Add or strengthen one concrete example.
3. Expand the `Build your operating system` section where it feels too thin.
4. Keep the chapter's story movement intact.
5. Make the artifact feel portable to a founder, operator, nonprofit leader, product manager, or team lead.

Return:
- a revised manuscript draft
- a short changelog by chapter
- a source-attribution changelog listing where YouTube endnote markers were added
- a list of any chapters that still need more lived examples
```

## Author decision gates

Decide before the next full prose pass:

- Should the main manuscript contain compact worksheets only, with the companion workbook holding the full templates?
- Should the book include blank worksheet pages after each act?
- Should `Agentified` ship with a separate downloadable workbook/PDF?
- Should the Portfolio source map stay in the public workbook, or become an internal author reference only?
- Which chapters should receive visible endnote markers in the prose, versus keeping citations only in the endnotes appendix?
