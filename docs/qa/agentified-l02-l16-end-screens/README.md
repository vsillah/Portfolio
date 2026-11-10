# Agentified L02-L16 end-screen QA

This lane extends the Human QA-approved L01 end-screen system from Portfolio commit `5570138a0cc4e02c4cea0dca81e1bf977a647a63` to L02-L16 without changing lesson media bytes or timing.

## Binding rules

- Each overlay begins at the exact final sentence-complete VTT cue boundary recorded in `lib/agentified-end-screens.ts`.
- L02-L15 show the actual next lesson cover and cumulative course progress.
- L16 shows a branded course-complete treatment.
- Seeking before the boundary removes the overlay; the ended state keeps it visible.
- The overlay leaves the native video controls unobscured.
- Native-control clearance scales from 64px in the compact player to 96px in the full-width player, and rendered QA verifies that exact reserve.
- Exact composite and caption hashes fail closed before a binding is returned.

## Validation

- Focused tests: `35/35` passed.
- Production build: passed after hydrating the worktree's existing local environment reference.
- Repository-wide `tsc --noEmit`: blocked by pre-existing unrelated errors in campaign, social, Trumpet, generated knowledge, and migration test files. The Next production build's type gate passed.
- Rendered QA: `node scripts/qa/record-agentified-l02-l16-end-screens.mjs <base> <commit>`.
- Representative boundaries: L02, L04, L15, and L16 at desktop and mobile widths.

The MP4 walkthroughs and stills in this directory are privacy-safe and use only public course media and local guest state.
