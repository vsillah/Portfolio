# Dark Castle thumbnail candidate repair Human QA

- Branch: `codex/dark-castle-thumbnail-candidate-repair`
- Commit: `de902c5f`
- Review route: `http://127.0.0.1:3231/admin/social-content/dark-castle-youtube-master-review?rev=de902c5f#thumbnail-heading`
- Preserved: Direction A remains unchanged.
- Replaced: Direction B now has a distinct pattern-alert hero shot; Direction C now has a distinct skeptical-reaction hero shot without the rejected circular blur or mask.
- Contract: every candidate requires a campaign-specific hero, integrated product proof, feed-size legibility, unobscured face, and no blur-mask artifacts.
- External gates: providers, uploads, platform drafts, scheduling, publishing, cross-posting, and external sends remain closed.

## Validation

- 40 focused Vitest cases passed.
- Production build passed.
- Full-size, 320 x 180, and 160 x 90 raster inspection passed.
- Desktop review: 1440 x 900.
- Mobile review: 390 x 844 with no horizontal overflow.
- Both walkthroughs select B, select C, and return to A.
