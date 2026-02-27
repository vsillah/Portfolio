# ElevenLabs Listen block: check for player only after script has loaded

**Type:** Improvement  
**Priority:** Low  
**Effort:** Small  

---

## TL;DR

When hiding the "Listen" placeholder when the player does not display, run the "check for iframe" delay only **after** the ElevenLabs helper script has actually loaded (`script.onload`), instead of using a fixed delay from mount. This avoids hiding the block too early on slow networks.

---

## Current state

- [PublicationCardAudio](components/PublicationCardAudio.tsx) uses a fixed delay (e.g. 2.5 s) after mount, then checks for an iframe to decide whether to hide the Listen block.
- On slow networks the script may load after that delay, so we might hide the block even though the player would have rendered a bit later.

## Expected outcome

- `loadScript()` (or equivalent) returns a `Promise` that resolves when the script’s `onload` fires.
- The "check for iframe" timeout starts only after that promise resolves (with a short additional delay if needed for the script to init the widget).
- Result: we don’t hide the placeholder prematurely on slow script load.

---

## Relevant files

- **`components/PublicationCardAudio.tsx`** — Refactor `loadScript()` to return a Promise; in the detection effect, await script load (or use a ref/callback) before starting the iframe-check delay.

---

## Notes / risks

- If the script is already in the DOM (e.g. second card), the "load" promise should resolve immediately so we don’t block.
- Backlog / "at a later date" — not required for initial "hide when no player" behavior.
