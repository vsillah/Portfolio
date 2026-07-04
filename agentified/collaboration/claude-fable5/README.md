# Claude/Fable 5 collaboration bridge

This folder holds Codex-to-Claude receipts for Agentified manuscript work.

## Verified local surface

- Claude Code CLI: `claude`
- Verified version: `2.1.139`
- Plain CLI smoke: `CLAUDE_CLI_OK`
- Fable 5 self-contained prompt smoke: `CLAUDE_FABLE5_CUSTOM_OK`

The local `claude agents` list currently reports only built-in agents. This bridge therefore defines the Fable 5 behavior through `agentified/prompts/fable5-collaboration-system.md` instead of depending on a hidden Claude app profile.

## Run the source smoke

```bash
cd /Users/vambahsillah/Projects/Portfolio
agentified/scripts/run-fable5-collaboration.sh \
  agentified/prompts/fable5-source-smoke.md \
  source-smoke
```

Expected output:

- A Markdown receipt under `agentified/collaboration/claude-fable5/runs/`
- Confirmation that the production draft contains the canonical subtitle
- The latest Google Doc pointer from `docs/agentified-portfolio-wiring.md`

## Run the manuscript review pass

```bash
cd /Users/vambahsillah/Projects/Portfolio
agentified/scripts/run-fable5-collaboration.sh \
  agentified/prompts/fable5-manuscript-fine-tune-review.md \
  manuscript-fine-tune-review
```

This pass is read-only. It asks Claude/Fable 5 for a review receipt with patch-ready language, diagram opportunities, and the next handoff.

## Source boundary

- The latest Claude/Drive manuscript pointer is tracked in `docs/agentified-portfolio-wiring.md`.
- Raw private manuscript material should remain in private manuscript or Drive surfaces.
- Public/docs surfaces should contain pointers, source maps, and approved summaries, not raw private exports.
