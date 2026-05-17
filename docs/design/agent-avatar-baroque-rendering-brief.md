# Agent Avatar Baroque Rendering Brief

## Direction

Portfolio agent avatars use square baroque portrait PNGs under `public/agent-avatars/baroque/<agentKey>.png`.

The accepted style is a front-facing engraved royal portrait with black, ivory, antique gold, and restrained per-agent accent color. Each portrait should remain readable in Portfolio Admin at `30px`, `44px`, and `54px`.

## Initials Rule

The initials are part of the artwork.

- Render each agent's two-letter initials as an engraved medallion, shield tab, collar plate, or lower-corner cartouche inside the portrait.
- Keep the initials large, high-contrast, and stylistically integrated with the baroque engraving.
- Do not add separate UI text overlays for initials on top of the PNG. The avatar component should let the artwork carry the monogram.
- Keep any component-level chrome limited to the avatar frame, border, accessible label, and fallback background.

## Differentiation

- Use the agent's existing accent tone from `lib/agent-avatars.ts` as a subtle wash in the regalia, halo, medallion, or gemstones.
- Keep the generated motif visible without relying only on text.
- Avoid extra labels, watermarks, logos, modern badges, side profiles, or low-contrast faces.

## Acceptance Gate

- The registry points to `/agent-avatars/baroque/<agentKey>.png`.
- All generated portraits are square `256x256` or larger.
- Initials are readable inside the portrait without component overlays.
- The set feels unified in Portfolio Admin while individual agents remain distinguishable by face, motif, initials, and accent color.
