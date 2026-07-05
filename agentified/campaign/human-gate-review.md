# Agentified campaign human gate review

Status: Human approval required
Campaign slug: `agentified-trust-scale-2026-07`
Gate owner: Vambah Sillah

## Gate decision

Current gate state: `pending`

No asset in this packet is approved for:

- external publishing
- external scheduling
- provider generation
- upload
- paid promotion
- email send
- public page replacement

## Approval checklist

Vambah should review each asset against these gates:

| Gate | Question | Required before |
| --- | --- | --- |
| Voice | Does this sound like Vambah: grounded, practical, reflective, systems-minded? | Any copy approval |
| Claim | Are the claims framed as book positioning or owned operating lessons, not unsupported industry claims? | Teach/proof assets |
| Privacy | Does the asset avoid private chats, raw manuscript notes, client data, screenshots, secrets, and unapproved inference? | Proof assets |
| Lineage | Does every "Accelerated" reference clearly refer to the book and connect to a specific concept? | SAM/AMINA assets |
| Visual | Is the cover or diagram approved for public use? | Cover reveal, carousels, shorts |
| CTA | Is the next step correct: `/agentified`, workbook preview, waitlist, preorder, or discovery call? | Offer assets |
| Channel | Is the selected channel right for this asset? | Calendar insertion |
| Timing | Is the proposed release date acceptable? | Calendar authorization |

## Asset decisions

Use this table for review.

| Asset ID | Decision | Notes |
| --- | --- | --- |
| `AGT-LI-01` | `pending` |  |
| `AGT-LI-02` | `pending` |  |
| `AGT-CAR-01` | `pending` |  |
| `AGT-LI-03` | `pending` |  |
| `AGT-SHORT-01` | `pending` |  |
| `AGT-LI-04` | `pending` |  |
| `AGT-CAR-02` | `pending` |  |
| `AGT-LI-05` | `pending` |  |
| `AGT-SHORT-02` | `pending` |  |
| `AGT-LI-06` | `pending` |  |
| `AGT-EMAIL-01` | `pending` |  |
| `AGT-PAGE-01` | `pending` |  |

Allowed decisions:

- `approved`
- `revise`
- `reject`
- `hold`

## Portfolio execution gate

After Vambah approves the campaign:

1. Create or update the `attraction_campaigns` row for `agentified-trust-scale-2026-07`.
2. Insert calendar rows into `social_content_calendar_items` with `authorization_status: pending`.
3. Keep `autonomy_eligible: false`.
4. Move individual items to `authorized` only after asset-specific approval.
5. Create downstream Social Content drafts only for authorized calendar rows.
6. Publish externally only through a separate final publishing gate.

## Review result

Codex review:

- The packet is source-safe.
- The campaign is tied to existing Portfolio campaign and social content calendar concepts.
- The draft assets preserve the Agentified thesis: agentic scale through trust.
- The strongest sequence is tease with trust risk, teach AMINA, proof with cover/workbook, offer through `/agentified`.

Open decisions for Vambah:

- Final CTA path.
- Whether cover comp A is public-approved.
- Whether short-form videos should be native recording, HeyGen, or text-over-image.
- Whether email should go to the full list or a smaller warm audience first.
