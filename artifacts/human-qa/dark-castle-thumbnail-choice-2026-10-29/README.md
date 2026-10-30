# Dark Castle thumbnail choice Human QA

- Branch: `codex/dark-castle-thumbnail-choice`
- Commit: `d63d9a6a`
- Review route: `http://127.0.0.1:3231/admin/social-content/dark-castle-youtube-master-review?rev=d63d9a6a#thumbnail-heading`
- Default selection: Direction A, `A MOVE ISN'T PROOF.`
- Interaction: each complete thumbnail card is a native radio choice; only one direction can be selected.
- External gates: provider calls, uploads, platform drafts, scheduling, publishing, cross-posting, and external sends remain closed.

## Validation

- Focused Vitest interaction test passed.
- Production build passed.
- Desktop review: 1440 x 1000.
- Mobile review: 390 x 844 with no horizontal overflow.
- Desktop and mobile MP4s show Direction B selected and then the review returned to Direction A.
