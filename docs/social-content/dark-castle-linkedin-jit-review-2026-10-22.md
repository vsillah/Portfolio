# Dark Castle Chess LinkedIn JIT review packet

**Target:** October 22, 2026, 11:30 AM ET. **Decision state:** blocked pending a current JIT receipt and Human QA of this visual/copy version. This is an internal, provider-free packet. The calendar item remains review only and the Social Content row remains a draft.

## Exact binding

| Item | Binding |
| --- | --- |
| Calendar item | `433f1ee0-6764-4b95-8745-8418e6498446` |
| Social Content record | `9817a689-0565-48ed-8c97-c2db40c1ec45` |
| Persisted content version | `sha256:585addaef15349ec135a57dd67308492110f6e97aecac2585e5936737d21918b` |
| Prior JIT observation | October 17, 2026, 11:08:19 AM ET; score 96 |
| Prior JIT expiry | October 20, 2026, 11:08:19 AM ET |
| Visual version | `sha256:8744666b8e38d71862088b08baebc63c39eafc4b50cacfa56944c29d30a09683` |
| Review route | `/admin/social-content/9817a689-0565-48ed-8c97-c2db40c1ec45?qa_fixture=social_campaign_review_assets_v1` |

The live read on October 21 showed `status=draft`, `image_url=null`, `authorization_status=pending`, and `publishing_authorized=false`. The calendar target was recalibrated to October 22 at 11:30:20 AM ET. The prior `human_qa_status=approved` is historical; it does not approve this new visual or refresh the expired JIT receipt.

## Customer-facing candidate

**Visual:** [Dark Castle LinkedIn review image](/review-assets/social-content/campaign-review/dark-castle-linkedin-remember-why.png). It shows the actual Explore board and the actual computer-response panel. It asks a useful product-design question without presenting in-product estimates as measured learning results.

**Proposed caption, review only:**

> A player opens with e4. The board remembers the move. What will help that player make the next decision?
>
> In Dark Castle Chess, Explore keeps the position, move guidance, and notation together. After the computer responds, the player can inspect candidate moves alongside the board. Those are visible product states, not a measured result.
>
> I think learning products should let people revisit the context of a choice. A completion marker tells us where someone stopped. A useful feedback loop helps the player see what changed and ask why. The next test is whether they can explain their next decision, without assuming that a correct move proves understanding.
>
> The practical check is simple: show the position, show the response, and invite the learner to say what they would try next. Then test that explanation with actual learners.
>
> What does your product give people after they get an answer right?
>
> #ProductDesign #LearningDesign #DarkCastleChess

The persisted draft has different text. This caption is a **new review candidate**, not a production update. Before any decision, compare the proposed caption with the current row, select one exact version, and recalculate its content-version receipt. The visual and caption must be approved together.

## Claim and asset lineage

| Visible statement or detail | Exact approved proof | Boundary |
| --- | --- | --- |
| Explore position, e4, move guidance, notation | `public/review-assets/social-content/storyboard-review/explore-position.jpg`, SHA-256 `896dce9162e815c1138dfbecacd24e0a63d05e99901f98b89022ddeee225f9df` | Shows product state only. |
| Computer response, Open Game line, candidate moves | `public/review-assets/social-content/storyboard-review/explore-computer.jpg`, SHA-256 `27d79426c04fa984569dc337623d1eb4a514392bf2e067563d9982d43d77dcdf` | Candidate percentages are in-product estimates, not evidence of learning gains. |
| Explore to play transition, available for review but not used in the visual | `public/review-assets/social-content/storyboard-review/explore-start.jpg`, SHA-256 `c794cc0b96ecde2be8b99fa930b45ac2a2e055d7ec92dc45654ac592082af3ae` | Shows a public product state; no outcome claim. |
| Rights, privacy, and approved-use scope | `artifacts/human-qa/artifact-video-review-2026-10-14/source-map.md` and `inputs/dark_castle_chess.json`; receipts `source:dark-castle-chess:approved-composite-20261014`, `privacy:dark-castle-chess:public-safe-20261014`, `rights:dark-castle-chess:owned-public-assets-20261014` | Use public gameplay captures; do not infer measured outcomes or native-store release. |
| Prior JIT source lineage | Approved record lists YouTube `K9vKzNJAp3U`, Springer DOI `10.1007/s10758-026-10032-5`, and FIDE `CM1-202605.pdf` | The receipt expired October 20. No claim from these sources is added to the visual or caption until the same lineage is refreshed and approved. |

The Portfolio repository and configured AmaduTown Google Drive were searched. The Drive project folder contains the Dark Castle release APK; Drive search also found project exports, but no additional image with a clearer approved-use receipt for this LinkedIn item. The repository's three public gameplay captures are the qualified image sources.

## Rendered review evidence

The [local Human QA evidence folder](../../artifacts/human-qa/dark-castle-linkedin-jit-2026-10-21/README.md) contains a playable MP4, desktop and mobile screenshots, the exact route, capture script, and result flags. The existing Social Content route was exercised at 1440 × 900 and 390 × 844. The image loaded, no horizontal overflow was observed, the claim trace expanded, and Approve/Reject stayed disabled. This is a repository-bound fixture, not a production-record smoke.

## Challenger pass

- **Voice:** The caption starts with the visible e4 moment, uses plain product language, and ends with a practical design question. The final copy removes the persisted draft's unverified first-person rebuilding claim and unsupported statement that a retained lesson is already proven.
- **Framework:** The visual uses a board and response detail as the argument. The question asks whether the player can explain the next choice; it is a design test, not a claim of measured improvement.
- **Originality:** No public thumbnail pixels, creator likeness, stock illustration, mechanical arrows, or repeated four-box campaign template were used. The visual is made from owned gameplay captures and AmaduTown brand assets.
- **Privacy and release:** No private chats, accounts, player identifiers, internal fixture text, receipts, or system notes appear on the public image. No native-store availability or measured learner result is claimed.
- **Staleness:** The visual can be reviewed, but the JIT decision remains blocked. A new approved observation must bind to the chosen content version and be current at the October 22 target.

## Required decision sequence

1. Review the image and proposed caption together on the exact Social Content route at desktop and mobile widths. Approve or request changes to this candidate only.
2. Re-run the approved JIT source check against the three existing lineage URLs and current product boundary. Record observation time, expiry, source receipts, and any changed claim or source status. If any source is missing, stale, ambiguous, or unapproved, keep the item blocked.
3. Choose the final caption, recompute the content-version receipt, and verify that the visual SHA-256 and caption version match the review decision. A changed caption, visual, or source set requires a new decision.
4. Keep provider call, upload, platform draft, scheduling, publishing, external send, credential change, and production write gates closed. Any later external action needs its own authority and current receipt.
