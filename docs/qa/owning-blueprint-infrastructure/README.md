# Owning the Block blueprint correction evidence

## Binding and provenance

- Base `origin/main`: `b2eb9cbb00f392d72af0291e73f541109f3c8423` (merged PR #1285).
- Blueprint source commit: `2c2635264032948eb661216e63042b283d6a1c13`. Manhole correction source commit: `93de677fda234b3b8ed31ebd516fa84947897b71`.
- Current source before correction: `docs/insights/source-snapshots/owning-the-block.f511f78e.html`, SHA-256 `f511f78e35d60bbc6181d01e76aa11dcccccf85026d564acb591003d1dcc4e96`.
- Original protected source: `docs/insights/source-snapshots/owning-the-block.d8cd0ac3.html`, SHA-256 `d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b`.
- Claude correction brief: `docs/insights/source-snapshots/owning-the-block.blueprint-brief.9753a408.md`, SHA-256 `9753a4080c6e34fe713fdde0813cab13e00d0e311328748ab50936b4d7440361`.
- First returned source: `docs/insights/source-snapshots/owning-the-block.1c623afa.html`, SHA-256 `1c623afa0472b7e3ac011a416558ba71aa242b58f6f330292d6ff9be5cf0be93`. Manhole brief: `docs/insights/source-snapshots/owning-the-block.manhole-brief.61c774cb.md`, SHA-256 `61c774cb1087803b0cbfef6e4fe527de81eb699ad338e91ca8ffdf4cd28d45d8`. Final returned source: `public/insights/equity-code/owning-the-block.html`, SHA-256 `339b450307ca6d37dfdac398c868012e89e97db81de224ac696a2be7f63410f0`. Each returned HTML was imported byte for byte from Claude's output.
- User-supplied treatment image: `/var/folders/q2/spyh50y9083bsnp9059ttv400000gn/T/codex-clipboard-60dd1812-0d04-4ba6-bbfb-57551e7b2788.png`. Used only as a visual-language reference for architectural sectional linework. Its subject, text, dimensions, and geometry were excluded. The image was not staged or published.
- Claude CLI was signed in through the existing `claude.ai` account. The first authoring run used `--max-budget-usd 8.50` and reported US$1.4857884 usage. The follow-up diagnosis used `--max-budget-usd 8.50` and reported US$0.5151518; the correction used `--max-budget-usd 8.00` and reported US$0.7464982. Total reported usage across these runs was US$2.7474384; invoice status is unverified. A preliminary attempt using an invalid environment API key spent US$0 and produced no source.

## Scope and checks

The first correction changed only underground decorative tokens/styles and the `buildCity()` drawing. Claude then identified the two round street marks as actual access covers at x=262 and x=730 above the shafts, with no separate pothole geometry. The follow-up changes only cover/collar styles and their `buildCity()` geometry: shallow elliptical outer rims, recessed lid rings, grate bars, and tapered collars connected to shafts. No pavement damage was invented. The research data, node and edge creation, interactions, labels, theme controls, and HTML structure are preserved by source comparison. Utilities remain noninteractive, masked behind research nodes, and separate from data connectors.

`results.json` records 13 browser checks across 1440×900, 768×900, and 390×844, Dark/Light/System, node/build interactions, responsive frame geometry, exact manhole geometry, and mobile horizontal panning. The two MP4s are focused walkthroughs from the exact source commit and route, with a building selection, build trace, Dark/Light transition, and mobile pan. They use public dashboard content only.

- `desktop-1440x900.mp4`: 8.28 seconds, H.264 MP4, SHA-256 `36ef36c16663f364aa38891eb3533e334479f9f2125d0e20c244b00e4072a41d`.
- `mobile-390x844.mp4`: 11.92 seconds, H.264 MP4, SHA-256 `6adb991b9d3008fe92103ac9c6ea406c4fda2677062c47a60af2fcd9c85955a1`.
- Local review URL: `http://127.0.0.1:4173/insights/owning-the-block?rev=93de677fda234b3b8ed31ebd516fa84947897b71`.

The integrated in-app browser was not exposed in this chat. The exact route was inspected in the available Chrome browser and left open. No staging/production deployment, live customer-data smoke, or Human QA approval occurred in this lane.

Encoded frame inspection: desktop Dark at 2 seconds and Light at 7 seconds; mobile Dark at 2 seconds and Light at 7 seconds. Full frames and enlarged crops of the manhole region were checked for rim, grate, shaft alignment, contrast and label clearance.
