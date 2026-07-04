#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHAPTER_DIR="$ROOT/manuscript/production-draft/chapters"
OUT="$ROOT/manuscript/production-draft/agentified-production-draft.md"
ENDNOTES="$ROOT/manuscript/references/formal-endnotes.md"

mkdir -p "$(dirname "$OUT")"

append_chapter() {
  local file="$1"
  printf "\n\n"
  cat "$CHAPTER_DIR/$file"
}

{
  cat <<'EOF'
# Agentified

## The Product Leader's Guide to Superhuman Acceleration Built on Trust

Vambah Sillah

Production draft assembled on 2026-07-04.

Status: production-shaping draft for author review.

---

## Table of contents

- A critical note on agent safety
- Act I: The Harness
  - Chapter 1: The First Receipt
  - Chapter 2: Agents Need Jobs Not Vibes
  - Chapter 3: Start With The Decision
  - Chapter 4: The Trace Harness
  - Chapter 5: Data Safety Becomes Source Safety
  - Chapter 6: From Feedback To Memory
  - Chapter 7: The Controller Brain
  - Chapter 8: The Operating Map
- Act II: Authority
  - Chapter 9: The Permission Slip
  - Chapter 10: The Priority Trap Returns
  - Chapter 11: PRDs For Agents
  - Chapter 12: Swarms Need Org Charts
  - Chapter 13: Handoffs Are Product Interfaces
  - Chapter 14: The Evaluation Loop
  - Chapter 15: Metrics That Matter For Agents
  - Chapter 16: Human Review Is The Trust Layer
  - Chapter 17: Money Needs A Gate
  - Chapter 18: The Decision Theater Rebuilt
- Act III: The Agentified Organization
  - Chapter 19: Mission Control
  - Chapter 20: Slack Is The Unblock Lane
  - Chapter 21: Client-Safe Proof
  - Chapter 22: The Mobile Foundry Test
  - Chapter 23: AutoResearch Without Autonomy Theater
  - Chapter 24: The Board Demo
  - Chapter 25: The Agentified Day
  - Chapter 26: What Comes Next
- Appendix: Frameworks and operating tools
- Appendix: Author review decisions

---
EOF

  append_chapter "ch00-critical-note-on-agent-safety.md"

  cat <<'EOF'


# Act I: The Harness

Before agents earn authority, their work has to become visible, reviewable, and recoverable.
EOF
  append_chapter "ch01-the-first-receipt.md"
  append_chapter "ch02-agents-need-jobs-not-vibes.md"
  append_chapter "ch03-start-with-the-decision.md"
  append_chapter "ch04-the-trace-harness.md"
  append_chapter "ch05-data-safety-becomes-source-safety.md"
  append_chapter "ch06-from-feedback-to-memory.md"
  append_chapter "ch07-the-controller-brain.md"
  append_chapter "ch08-the-operating-map.md"

  cat <<'EOF'


# Act II: Authority

Once agent work is visible, the hard question changes: what are agents allowed to do, and who grants that authority?

Amina's next discipline is to map authority before expanding it. An agent can prepare useful work long before it should be allowed to create side effects. The ladder below gives the reader a simple way to see the climb.

### Figure II.1: Authority ladder

![Authority ladder](/Users/vambahsillah/Projects/Portfolio/agentified/manuscript/visuals/rendered/print/color-600dpi/figure-ii-1-authority-ladder-print-600dpi.png)

Authority should climb only when evidence climbs with it. The higher the side effect, the stronger the receipt, gate, and rollback path must be.
EOF
  append_chapter "ch09-the-permission-slip.md"
  append_chapter "ch10-the-priority-trap-returns.md"
  append_chapter "ch11-prds-for-agents.md"
  append_chapter "ch12-swarms-need-org-charts.md"
  append_chapter "ch13-handoffs-are-product-interfaces.md"
  append_chapter "ch14-the-evaluation-loop.md"
  append_chapter "ch15-metrics-that-matter-for-agents.md"
  append_chapter "ch16-human-review-is-the-trust-layer.md"
  append_chapter "ch17-money-needs-a-gate.md"
  append_chapter "ch18-the-decision-theater-rebuilt.md"

  cat <<'EOF'


# Act III: The Agentified Organization

The demo can impress a room. The operating rhythm is what survives Monday morning.
EOF
  append_chapter "ch19-mission-control.md"
  append_chapter "ch20-slack-is-the-unblock-lane.md"
  append_chapter "ch21-client-safe-proof.md"
  append_chapter "ch22-the-mobile-foundry-test.md"
  append_chapter "ch23-autoresearch-without-autonomy-theater.md"
  append_chapter "ch24-the-board-demo.md"
  append_chapter "ch25-the-agentified-day.md"
  append_chapter "ch26-what-comes-next.md"

  cat <<'EOF'


# Appendix: Frameworks and operating tools

| Framework | Chapter | Production treatment |
| --- | --- | --- |
| Agent Work Receipt | 1 | Table or worksheet |
| Agent JD | 2 | One-page worksheet |
| Decision Card | 3 | Card template |
| Trace Harness | 4 | Five-question diagram |
| Source Safety Ladder | 5 | Ladder diagram |
| S-E-P-M Pipeline | 6 | Flow diagram |
| Controller Loop | 7 | Loop diagram |
| Operating Map | 8 | Lifecycle map |
| Permission Slip | 9 | One-page form |
| Quarterly Cull | 10 | Scoring table |
| Agentic PRD Packet | 11 | Checklist |
| Pod Model | 12 | Org chart |
| Handoff Contract Card | 13 | Interface card |
| Evaluation Loop | 14 | Loop diagram |
| Agent Metrics Ladder | 15 | Ladder diagram |
| Review Postures | 16 | Matrix |
| Spend Envelope | 17 | Approval packet |
| Decision Brief | 18 | Brief template |
| Cockpit Loop | 19 | Operating loop |
| Unblock Ladder | 20 | Ladder |
| Scoped Proof Loop | 21 | Export flow |
| Foundry Test | 22 | Rubric |
| AutoResearch Ladder | 23 | Gate flow |
| Three-Panel Demo | 24 | Presentation storyboard |
| Six-Beat Day | 25 | Daily rhythm |
| Accountability Stack | 26 | Stack diagram |

## Recommended visual priorities

1. Agent Work Receipt
2. Source Safety Ladder
3. Operating Map
4. Permission Slip
5. Evaluation Loop
6. Spend Envelope
7. Unblock Ladder
8. Six-Beat Day
9. Accountability Stack

EOF

  printf "\n\n"
  cat "$ENDNOTES"

  cat <<'EOF'

# Appendix: Author review decisions

- Final subtitle selected: The Product Leader's Guide to Superhuman Acceleration Built on Trust.
- Decide whether the safety note remains a safety note or becomes a preface.
- Decide whether to include diagrams in the manuscript, a companion workbook, or both.
- Decide whether named scenes remain fictional/composite in all cases.
- Decide whether any real Portfolio screenshots or route names are approved for public use.
- Decide whether formal endnote markers should be inserted in the prose during the next revision pass.
- Decide whether `Agentified` should include an acknowledgments section, resource page, or companion course note.
EOF
} > "$OUT"

wc -w "$OUT"
