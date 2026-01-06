Tailwind CSS v4 Cursor Rules (from https://tailwindcss.com/blog/tailwindcss-v4)

Purpose
- Keep agents aligned on Tailwind v4 changes and migration expectations.

Defaults and install
- Prefer v4; do not add or restore v3 `tailwind.config.js` or `content` array.
- Install: `npm i tailwindcss @tailwindcss/postcss` (or `@tailwindcss/vite` for Vite).
- PostCSS: `export default { plugins: ["@tailwindcss/postcss"] };`
- CSS entry: `@import "tailwindcss";` (no `@tailwind base/components/utilities`).

Configuration model (CSS-first)
- Customize tokens/utilities in CSS via `@theme { ... }`; expect CSS variables (colors, spacing, breakpoints, fonts).
- Avoid JS config for theme/extensions unless unavoidable; keep all design tokens in CSS.

Content scanning
- v4 auto-detects sources using heuristics and `.gitignore`. Do not add manual `content` config.
- To include extra sources, use `@source "<relative-or-package-path>";` in CSS instead of editing config files.

Performance expectations
- Builds are ~3–5x faster; incremental rebuilds can be 100x faster. Do not add unnecessary tooling that slows the pipeline.

Utility and API shifts
- Gradients: `bg-gradient-*` renamed to `bg-linear-*`; new conic and radial via `bg-conic-*`, `bg-radial-*`; interpolation modifiers `/srgb`, `/oklch`.
- Dynamic values: grids (`grid-cols-*`), spacing (`mt-*`, `w-*`, `px-*`), and data-attribute variants accept arbitrary numbers without config.
- Container queries: use `@container` with `@sm`, `@lg`, `@min-*`, `@max-*`; drop the old plugin.
- New variants: `starting:` (for @starting-style), `not-*`, `in-*`, `descendant`, `inert:`, extended `open` (popover), `nth-*`, `color-scheme`, `field-sizing`, `inset-shadow-*`/`inset-ring-*`, 3D transforms (`rotate-x-*`, `translate-z-*`, `scale-z-*`).
- Color palette now uses OKLCH/P3; expect slightly more vivid defaults.

Migration do/don’t
- Do replace `@tailwind base/components/utilities` with a single `@import "tailwindcss";`.
- Do move theme tokens from `tailwind.config.js` into CSS `@theme`.
- Do remove custom content globs; rely on auto-detection or `@source`.
- Do rename gradient utilities to `bg-linear-*`.
- Do remove the container-queries plugin.
- Don’t reintroduce postcss-import for Tailwind; imports are handled internally.
- Don’t assume arbitrary values need bracket syntax when a direct class exists in v4.

Examples
- Minimal CSS:  
  `@import "tailwindcss";`  
  `@theme { --color-brand: oklch(0.6 0.12 250); }`
- Add extra source:  
  `@source "../node_modules/@my-org/ui";`
- Container query: parent `class="@container"`, child `class="grid @sm:grid-cols-3 @max-md:grid-cols-1"`.

Agent checklist
- When editing styles, use v4 utilities and variants; prefer CSS `@theme` for tokens.
- Avoid adding legacy config or plugins; prefer built-in v4 features.
- If unsure whether a value needs brackets, try the direct class first (dynamic utilities).
- Call out v3-only patterns and replace them with v4 equivalents during reviews.
