# Dark Castle Direction C selection Human QA

- Branch: `codex/dark-castle-thumbnail-c-selection`
- Implementation commit: `eec10fc8`
- Review route: `http://127.0.0.1:3231/admin/social-content/dark-castle-youtube-master-review?rev=eec10fc8#thumbnail-heading`
- Approved: Direction C, `accidental-success`, asset SHA-256 `5aab7cf806aae27ddafe7042f74f12bdf7caa18f6155154d8e0e6f14c25af6f0`.
- Comparison behavior: Directions A and B remain review evidence only. Previewing either cannot overwrite the approved C receipt.
- Durable rule: every three-option YouTube thumbnail set must include at least one evidence-backed expressive-face candidate whose expression reinforces the topic.
- External gates: providers, uploads, platform drafts, scheduling, publishing, credential changes, production-data mutations, and external sends remain closed.

## Validation

- 40 focused Vitest cases passed.
- Production build passed.
- Desktop review: 1440 x 900.
- Mobile review: 390 x 844.
- Both walkthroughs confirm C, preview B without changing approval, and return to C.
