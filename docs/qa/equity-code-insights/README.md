# Equity Code Insights review

Review target: local Portfolio build at `http://localhost:4173/insights` and its three Equity Code routes. The source HTML and the ledger's two relative scripts match the hashes in `docs/insights/equity-code-source-register.md`.

Run `node scripts/qa/equity-code-insights-review.cjs` while the local server is listening on port 4173. The script records `desktop.mp4` at 1440×900 and `mobile.mp4` at 390×844, walks from the Insights index into each dashboard, exercises representative controls with mouse and keyboard, verifies source links in the ledger, checks page-level overflow, and loads the three routes with reduced motion requested. `review-results.json` records the measured widths and video paths.

## Source correction for Claude

The Compounding Graph's authored SVG labels overlap and some names clip at desktop width; they become harder to read at the 390px content lane. The issue is visible in the exact source file and its Portfolio route. Keep the supplied HTML hash unchanged in this integration PR. Claude should correct the original source's label layout or responsive presentation, then publish an updated source file for a separately verified re-import.

The Home Front Ledger HTML was described as self-contained, but it loads public `world.js` and `data.js` relative to the page. Those exact scripts are included and rewritten to the route's resolved paths. The unchanged HTML also loads D3 and TopoJSON from cdnjs and Google Fonts. Offline behavior for those third-party dependencies was not tested.

The MP4s use public dashboard content only. They contain no account data, private planning material, or credentials.
