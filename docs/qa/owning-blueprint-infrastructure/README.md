# Owning the Block blueprint correction evidence

## Binding and provenance

- Base `origin/main`: `b2eb9cbb00f392d72af0291e73f541109f3c8423` (merged PR #1285).
- Dashboard source commit: `2c2635264032948eb661216e63042b283d6a1c13`.
- Current source before correction: `docs/insights/source-snapshots/owning-the-block.f511f78e.html`, SHA-256 `f511f78e35d60bbc6181d01e76aa11dcccccf85026d564acb591003d1dcc4e96`.
- Original protected source: `docs/insights/source-snapshots/owning-the-block.d8cd0ac3.html`, SHA-256 `d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b`.
- Claude correction brief: `docs/insights/source-snapshots/owning-the-block.blueprint-brief.9753a408.md`, SHA-256 `9753a4080c6e34fe713fdde0813cab13e00d0e311328748ab50936b4d7440361`.
- Returned source: `public/insights/equity-code/owning-the-block.html`, SHA-256 `1c623afa0472b7e3ac011a416558ba71aa242b58f6f330292d6ff9be5cf0be93`. Imported byte for byte from Claude's output.
- User-supplied treatment image: `/var/folders/q2/spyh50y9083bsnp9059ttv400000gn/T/codex-clipboard-60dd1812-0d04-4ba6-bbfb-57551e7b2788.png`. Used only as a visual-language reference for architectural sectional linework. Its subject, text, dimensions, and geometry were excluded. The image was not staged or published.
- Claude CLI was signed in through the existing `claude.ai` account. The run used `--max-budget-usd 8.50`; its returned usage was US$1.4857884. A preliminary attempt using an invalid environment API key spent US$0 and produced no source.

## Scope and checks

Claude changed only underground decorative tokens/styles and the `buildCity()` drawing. The research data, node and edge creation, interactions, labels, theme controls, and HTML structure are preserved by source comparison. Utilities remain noninteractive, masked behind research nodes, and separate from data connectors.

`results.json` records 13 browser checks across 1440×900, 768×900, and 390×844, Dark/Light/System, node/build interactions, responsive frame geometry, and mobile horizontal panning. The two MP4s are focused walkthroughs from the exact source commit and route, with a building selection, build trace, Dark/Light transition, and mobile pan. They use public dashboard content only.

- `desktop-1440x900.mp4`: 8.52 seconds, H.264 MP4.
- `mobile-390x844.mp4`: 11.92 seconds, H.264 MP4.
- Local review URL: `http://127.0.0.1:4173/insights/owning-the-block?rev=2c2635264032948eb661216e63042b283d6a1c13`.

The integrated in-app browser was not exposed in this chat. The exact route was inspected in the available Chrome browser and left open. No staging/production deployment, live customer-data smoke, or Human QA approval occurred in this lane.
