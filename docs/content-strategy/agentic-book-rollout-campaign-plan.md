# Agentic book rollout whisper_to_shout campaign plan

Status: review-ready campaign seed
Template: `whisper_to_shout`
Window: 14 days
Primary surface: Portfolio Content Intelligence calendar

## Goal

Create a campaign around the Agentic book rollout that proves the central argument before asking anyone to care about the book:

AI agents are moving into real work faster than most teams can explain who owns the output, what evidence it used, what authority it had, and which human approved the handoff.

The campaign should make the operating layer visible. It should use Portfolio as the receipt: source packets, calendar milestones, challenger review, script review, asset review, and platform submission gates.

## Source Packet

Use these existing sources before generating new drafts:

| Source | Use |
| --- | --- |
| `docs/agentic-value-communications-plan.md` | Campaign architecture, channel map, challenger loop, first production backlog. |
| `docs/agentic-content-research-briefs/phase-2-research-dossier.md` | Research-backed claims and proof boundaries. |
| `docs/agentic-content-linkedin-drafts/wave-1-drafts.md` | First-pass LinkedIn material to revise, not duplicate. |
| `docs/agentic-content-video-scripts/wave-1-youtube-scripts.md` | YouTube and short-form script source material. |
| `docs/agentic-content-review-packets/p0-challenger-review-packets.md` | Human-review-ready P0 packet references. |
| `docs/agentic-content-review-packets/p1-challenger-review-packets.md` | Human-review-ready short-form packet references. |
| `docs/agentic-os-client-advisory-explainer.md` | Client-safe advisory positioning. |

Private meetings, Chronicle notes, raw chats, credentials, account IDs, and client records stay out of public drafts.

## Campaign Arc

| Day | Phase | Core Message | Primary Calendar Item |
| --- | --- | --- | --- |
| 1 | Tease | Anyone can launch an agent now. The harder question is who is responsible when it acts. | LinkedIn flagship post plus Short cutdown. |
| 4 | Teach | The agent is not the operating system. The harness is. | Framework post plus Short explaining the source -> challenger -> approval path. |
| 9 | Proof | The receipt is the path the work traveled. | Portfolio proof post with screenshot carousel and b-roll capture list. |
| 13 | Offer | Follow the Agentic rollout for the field guide behind governed AI operations. | Launch invitation post plus Short/Reel/TikTok handoff. |

## Channel Lanes

Each milestone should create review packets for:

| Channel | Needed Inputs |
| --- | --- |
| LinkedIn | Post text, CTA, CTA URL, hashtags, references, visual recommendation. |
| YouTube Shorts | Hook, first 30 seconds, 45-second script, storyboard, b-roll hints, on-screen text, caption. |
| Instagram Reels | Hook, script, caption, safe-area notes, b-roll assets. |
| TikTok | Hook, script, caption, audio rights, safe-area notes. |
| Thumbnail | Pattern explanation, short text, proof-screen direction, 2-3 variants. |

## Approval Path

The Portfolio path should stay explicit:

1. Shaka proposes the milestone from the campaign calendar.
2. Source packet and channel drafts are attached to the central backlog work item.
3. Amina performs challenger review before human review.
4. Vambah approves or rejects each channel lane with a decision note.
5. Approved lanes move to asset production.
6. Asset production moves through privacy/redaction review.
7. Platform draft handoff is authorized.
8. Final platform submission is approved separately.
9. Only then can automatic platform submission run through connected integrations.

## Seeded Fixture

Use Admin Testing demo seed key:

`agentic_book_rollout_campaign_fixture`

Expected fixture output:

- 1 `attraction_campaigns` row.
- 1 campaign goal in `agent_work_items`.
- 4 phase work items using `source_type='social_topic_trigger'`.
- 1 public-safe research packet.
- 8 calendar items: 4 primary LinkedIn milestones and 4 YouTube Shorts companion milestones.
- Draft packets for LinkedIn, YouTube Shorts, Instagram Reels, TikTok, and Thumbnail stored in work item metadata.

No provider calls, rendering, uploads, external schedules, platform posts, or publishing should run from the seed.

## Next Production Step

After seeding, open Content Intelligence and filter the calendar to `Agentic Book Rollout Whisper-to-Shout Campaign`. Start with Day 1 Tease. The first approval target should be the LinkedIn post and short-form script packet for:

`Anyone can launch an agent now`
