# Agentified release calendar

Status: Draft calendar
Campaign slug: `agentified-trust-scale-2026-07`
Template: `whisper_to_shout`
Window: 2026-07-13 through 2026-07-26
External scheduling: Blocked until human approval

## Calendar

| Date | Time ET | Asset ID | Phase | Channel | Title | Purpose | Authorization |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| 2026-07-13 | 9:00 AM | `AGT-LI-01` | `tease` | LinkedIn | The speed problem is becoming a trust problem | Open the campaign with the central operating tension. | `pending` |
| 2026-07-14 | 12:00 PM | `AGT-LI-02` | `tease` | LinkedIn | The first agentic failure is usually a handoff failure | Make the issue concrete for product leaders. | `pending` |
| 2026-07-15 | 9:00 AM | `AGT-CAR-01` | `teach` | LinkedIn carousel | AMINA: the operating loop for agentic work | Teach the five-part frame. | `pending` |
| 2026-07-16 | 12:00 PM | `AGT-LI-03` | `teach` | LinkedIn | What "Accelerated" taught me about Agentified | Tie the new book to the SAM loop lineage. | `pending` |
| 2026-07-17 | 3:00 PM | `AGT-SHORT-01` | `teach` | YouTube Shorts / Reels | Agentic work needs an operating system | Short spoken teaching clip. | `pending` |
| 2026-07-20 | 9:00 AM | `AGT-LI-04` | `proof` | LinkedIn | Cover reveal: Agentified | Reveal the cover direction and campaign promise. | `pending` |
| 2026-07-21 | 12:00 PM | `AGT-CAR-02` | `proof` | LinkedIn carousel | From SAM to AMINA | Show the lineage from "Accelerated" to Agentified. | `pending` |
| 2026-07-22 | 9:00 AM | `AGT-LI-05` | `proof` | LinkedIn | The workbook is where the book becomes operational | Preview the workbook as a reader tool. | `pending` |
| 2026-07-23 | 3:00 PM | `AGT-SHORT-02` | `proof` | YouTube Shorts / Reels | What the cover is really showing | Explain the SAM/Amina visual metaphor. | `pending` |
| 2026-07-24 | 9:00 AM | `AGT-LI-06` | `offer` | LinkedIn | Agentified is for the product leader carrying the risk | Make the release path clear. | `pending` |
| 2026-07-25 | 10:00 AM | `AGT-EMAIL-01` | `offer` | Email/newsletter | Agentified: achieve agentic scale through trust | Owned-channel launch note. | `pending` |
| 2026-07-26 | 12:00 PM | `AGT-PAGE-01` | `offer` | Portfolio page | Agentified campaign CTA block | Update `/agentified` after author approval. | `pending` |

## Calendar notes

- Dates are proposed review slots, not external publishing commitments.
- Each item should enter Portfolio's Social Content calendar with `authorization_status: pending`.
- `autonomy_eligible` should stay `false`.
- Any provider generation, upload, or external publishing remains outside this packet.
- If Vambah approves only part of the calendar, approved items can move while the others stay parked.

## Portfolio import shape

Use `agentified/campaign/portfolio-campaign-packet.json` as the machine-readable packet.

The JSON packet maps each calendar row to:

- `campaign_slug`
- `campaign_phase`
- `channel`
- `title`
- `planned_angle`
- `scheduled_for`
- `authorization_status`
- `metadata.asset_id`
- `metadata.human_gate_required`
- `metadata.draft_asset_path`
