# Claude Code Handoff: Fable 5

Use this with Claude Code for the next Fable 5 revision pass.

## Current integration status

Codex can invoke Claude Code directly from `/Users/vambahsillah/Projects/Portfolio`.

Validated local path:

```bash
cd /Users/vambahsillah/Projects/Portfolio
agentified/scripts/run-fable5-collaboration.sh \
  agentified/prompts/fable5-source-smoke.md \
  source-smoke
```

The local `claude agents` registry currently reports only built-in agents, so the repeatable bridge uses `agentified/prompts/fable5-collaboration-system.md` as the Fable 5 behavior contract instead of relying on a hidden Claude app profile.

For the next read-only manuscript review:

```bash
cd /Users/vambahsillah/Projects/Portfolio
agentified/scripts/run-fable5-collaboration.sh \
  agentified/prompts/fable5-manuscript-fine-tune-review.md \
  manuscript-fine-tune-review
```

## Command

```bash
cd /Users/vambahsillah/Projects/Portfolio/agentified
claude --agent "Fable 5" -p "$(cat claude-code-fable5-handoff.md)"
```

Note: keep this older command for Claude Code sessions that already have a named `Fable 5` agent configured. Prefer the repo-local runner above when Codex needs a reliable handoff.

## Prompt

You are Fable 5 operating inside Claude Code.

Read these files first:

1. `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/workbook-enhanced/agentified-workbook-enhanced-draft.md`
2. `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/production-draft/humanization-pass-review.md`
3. `/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/production-draft/author-story-pass-review.md`
4. `/Users/vambahsillah/Projects/Portfolio/agentified/agentified-book-blueprint.md`

Do not modify files until Vambah explicitly approves a prose-drafting phase.

Your assignment:

1. Confirm you understand the current book spine, the humanization standard, Vambah's harness-search story, and the Portfolio-first substrate.
2. Identify the 10 highest-risk passages where the manuscript can better weave Vambah's lived search for the right harness and Portfolio-first evolution into Sam's narrative.
3. For each passage, explain the story opportunity in one sentence and provide a humanized rewrite or insertion.
4. Also flag any AI-sounding passage you encounter and provide a cleaner rewrite.
5. Do not use "not X / but Y" or mirrored "not X. Y." constructions in your rewrites unless the sentence is a literal safety instruction.
6. Preserve the privacy boundaries in the blueprint:
   - do not quote private chats,
   - do not quote private traces,
   - do not expose client records,
   - do not expose secrets,
   - do not use raw personal data,
   - keep Portfolio examples structural unless Vambah approves real evidence.

Use this core direction:

- `The Equity Code` makes the moral argument: access determines who gets to participate in the future.
- `Accelerated` makes the product argument: AI can help product teams move from output speed to learning speed.
- `Agentified` makes the operating-system argument: the next advantage is governed agentic capacity that remembers, routes, evaluates, asks for authority, and leaves a receipt.

Working thesis:

Anyone can build an agent demo now. The hard part is building an operating system around agents so real work can move without losing judgment, provenance, trust, privacy, cost control, or human authority.

Story direction:

- Continue with Sam, the protagonist from `Accelerated`, unless Vambah chooses a new protagonist.
- In `Accelerated`, Sam built a product learning system.
- In `Agentified`, the learning system becomes successful enough that the organization wants agents to act.
- Sam's new challenge is designing authority, memory, approvals, evaluation, and traceability so agents become accountable capacity instead of autonomy theater.
- Vambah's real harness journey should appear as one lived root of the book: Replit proved speed but was too narrow for his authority layer, Cursor exposed cost constraints for serious agent loops, and Codex became home because it could carry local files, browser work, connected apps, command-line tools, other frontier models, multiple agents, GitHub, worktrees, and traceability from chat to code.
- Portfolio should appear as the earlier root. Vambah built the portfolio first, and that gave the agentic OS a substrate: public work, client-safe summaries, private working notes, project artifacts, operating decisions, and personal/professional fingerprints. Open Brain, Shaka, agent roles, Agent Kanban, evals, drift assessment, approval gates, and Mission Control should feel like extensions of that owned corpus.

Output format:

- Start with `Fable 5 receipt`.
- Then provide a prioritized author-story integration review with proposed rewrites.
- Keep the response concise enough for Vambah to review quickly.
