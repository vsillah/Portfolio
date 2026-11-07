# Agentified L01–L16 visual source-binding review

This is a version-bound approval packet rooted at `de1e01f04393963db6fe93962af47c0bd77439d5`. `packets.json` binds all 16 merged lesson scripts and 19 approved plate uses to the exact storyboard passage, script SHA-256, source identity and SHA-256, source-map lineage, rights and attribution state, accessibility plan, intended use, and approval receipt. The scripts remain the source of narration, exercises, Operating File progression, Harbor Learning Circle continuity, and prepare-only authority. This packet does not revise them.

| Lesson | Candidate visual(s) | Decision |
| --- | --- | --- |
| L01 | First receipt | Approved for bound lesson uses |
| L02 | SAM trust layer | Approved for bound lesson uses |
| L03 | First receipt | Approved for bound lesson uses |
| L04 | A.M.I.N.A. inside SAM | Approved for bound lesson uses |
| L05 | Portfolio-first stack | Approved for bound lesson uses |
| L06 | Authority ladder | Approved for bound lesson uses |
| L07 | Authority ladder | Approved for bound lesson uses |
| L08 | First receipt | Approved for bound lesson uses |
| L09 | SAM trust layer; authority ladder | Approved for bound lesson uses |
| L10 | Authority ladder | Approved for bound lesson uses |
| L11 | Portfolio-first stack | Approved for bound lesson uses |
| L12 | First receipt | Approved for bound lesson uses |
| L13 | A.M.I.N.A. inside SAM | Approved for bound lesson uses |
| L14 | Portfolio-first stack; authority ladder | Approved for bound lesson uses |
| L15 | SAM trust layer | Approved for bound lesson uses |
| L16 | A.M.I.N.A. inside SAM; authority ladder | Approved for bound lesson uses |

The author approved `public/agentified-cover.jpg` as the canonical workshop cover and rejected the SVG candidate. The JPG identity and hash are recorded in `cover_hold`; the SVG was removed from the repository and active source register.

The original Accelerated SAM infographic was found at `/Users/vambahsillah/Library/CloudStorage/GoogleDrive-vsillah@gmail.com/My Drive/2. AmaduTown Advisory Solutions/Artifacts /Promotional /Accelerated Building Smarter Products with AI/Final/Accelerated_infographic.png`. Its repo-local copy and hash are recorded under `sam_lineage`. This establishes lineage only. No Drive file was copied or changed, and the original was not inserted into a lesson.

Representative text-only storyboard frames are in `frames/`. They use fictional Harbor material and neutral layout. They contain no embedded plate, cover, generated art, provider output, actual participant record, or internal production note. The frames are review candidates and have no publication authority.

Current gate: create scene-level production packets and provider-free animatics using only the approved hashes and lesson bindings. Provider calls, avatar or voice generation, upload, publication, and external distribution remain unauthorized.

Validation: `node agentified/workshop/visual-review/validate.mjs` and `node --test agentified/workshop/visual-review/validate.test.mjs`. The validator rejects source or script drift and all unapproved promotions. If a canonical input changes, prepare a new packet and seek review again.
