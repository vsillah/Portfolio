# Social decision theme hierarchy QA

Privacy-safe evidence for the shared Social Content decision panel. The fixture is authenticated locally, intercepts the canonical read routes, rejects the decision POST with `QA_FIXTURE_READ_ONLY`, and records zero provider or external-data requests.

## Review order

1. `light-mobile-focus.png` — light theme, 390 x 844, Approve focused.
2. `light-desktop-hover.png` — light theme, 1280 x 900, Request revision hovered.
3. `dark-mobile-pressed.png` — dark theme, 390 x 844, Hold pressed.
4. `dark-desktop-focus.png` — dark theme, 1280 x 900, Approve focused.
5. `system-mobile-disabled.png` — system theme resolving light, 390 x 844, fail-closed disabled controls.
6. `system-desktop-hover.png` — system theme resolving dark, 1280 x 900, Request revision hovered.
7. `social-decision-theme-parity.mp4` — playable walkthrough in the same sequence: light first, then dark and system parity.

## Boundaries

- No decision receipt is created.
- No content, provider, credential, schedule, publish, send, or production state is changed.
- The fixture preserves the canonical Decision Queue link, version binding, receipt readiness checks, and fail-closed blocked state.
- The generated artifacts contain synthetic IDs, synthetic copy, and no private account data.

## Reproduce

Run the local app with outbound automation disabled, then execute:

```sh
QA_BASE_URL=http://127.0.0.1:3011 node scripts/record-mobile-social-decision-qa.mjs
```
