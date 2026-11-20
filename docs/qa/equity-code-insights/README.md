# Equity Code Insights review

Review target: local Portfolio build at `http://localhost:4173/insights` and its three Equity Code routes. The source HTML and the ledger's two relative scripts match the hashes in `docs/insights/equity-code-source-register.md`.

Run `node scripts/qa/equity-code-insights-review.cjs` while the local server is listening on port 4173 to recheck all three dashboards, source links, page-level overflow, and reduced-motion loading. The original broad walkthroughs predate the Compounding Graph correction and are superseded by the focused videos below.

## Compounding Graph source correction

The original Compounding Graph's SVG labels overlapped and clipped at desktop and mobile widths. Claude supplied a bounded label-layout correction. The original file is preserved under `docs/insights/source-snapshots/`; the corrected file and its hash are recorded in the source register.

Run `node scripts/qa/equity-code-graph-correction.cjs` against the local production build to record `desktop-graph-correction.mp4` at 1440×900 and `mobile-graph-correction.mp4` at 390×844. Both videos open the Insights index, show the label-dense graph, and exercise color modes, a keyboard-selected node, a magnitude row, a verbatim chip, timeline scrubbing, and the source disclosure. `graph-correction-results.json` records the measured viewBoxes and collisions. At both widths, before and after interaction, all 35 nodes were present with zero label-label, label-circle, label-spoke, or viewBox-clipping intersections. The page had no horizontal overflow.

The Home Front Ledger HTML was described as self-contained, but it loads public `world.js` and `data.js` relative to the page. Those exact scripts are included and rewritten to the route's resolved paths. The unchanged HTML also loads D3 and TopoJSON from cdnjs and Google Fonts. Offline behavior for those third-party dependencies was not tested.

The MP4s use public dashboard content only. They contain no account data, private planning material, or credentials.
