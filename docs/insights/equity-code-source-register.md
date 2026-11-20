# Equity Code dashboard source register

The original dashboard files under `public/insights/equity-code/` were exact byte copies of public dashboards authored by Claude and published at the URLs below. The table preserves those source hashes. Later Claude-authored corrections are recorded separately below with their original snapshots and returned artifact hashes.

Retrieved: 2026-11-19 (America/New_York). Provenance: public source pages, fetched over HTTPS from `home-front-ledger.vercel.app`. No private chat or planning material is included.

This is an append-only source snapshot. Future source revisions should add a new retrieval record and hash rather than overwrite these entries.

| Original Portfolio route | Public source URL | SHA-256 |
| --- | --- | --- |
| `/insights/compounding-graph` | https://home-front-ledger.vercel.app/compounding-graph/ | `1822a76ec480782f14e873677dc77104680b212b3b534e6129608ea6420fef99` |
| `/insights/home-front-ledger` | https://home-front-ledger.vercel.app/home-front-ledger/ | `79f992fa0c00ac2cfde194b66d415e618dbdc40569ae9718e9f11a9df59bb79b` |
| `/insights/owning-the-block` | https://home-front-ledger.vercel.app/owning-the-block/ | `d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b` |

## Claude-authored Compounding Graph correction

On 2026-11-19, the original Compounding Graph file was preserved at `docs/insights/source-snapshots/compounding-graph.1822a76e.html`. Claude returned `/Users/vambahsillah/Downloads/compounding-graph.corrected.html`, SHA-256 `a207a6738e5392f114aba65350c526e9b532ab6471c67e72b1057e25970f3d80`. That exact file now serves `/insights/compounding-graph`. The local artifact is the correction source; it was not presented as a new published URL.

The only source diff is one contiguous SVG label-layout block. It records spoke and node labels, positions them to avoid label/circle collisions, reruns layout after fonts load, and fits the SVG viewBox. Research data, event relationships, figures, citations, colors, controls, and handlers outside the block match the preserved original. Home Front Ledger retains its original hash above.

## Claude-authored Owning the Block correction

On 2026-11-19, the original Owning the Block file was preserved byte for byte at `docs/insights/source-snapshots/owning-the-block.d8cd0ac3.html`, SHA-256 `d8cd0ac397adcfc1271d2f14d016d19271aa2828905510b03896b6e18067c24b`. The exact correction brief is preserved at `docs/insights/source-snapshots/owning-the-block.claude-brief.3e48f6e7.md`, SHA-256 `3e48f6e7236103557f5ae0e6b9f9704fb388cedfbe55c1ead591782e4d5d25e6`.

Claude returned `/tmp/claude-owning-block.G03dYo/owning-the-block.corrected.html`, SHA-256 `f511f78e35d60bbc6181d01e76aa11dcccccf85026d564acb591003d1dcc4e96`. It was copied verbatim to `public/insights/equity-code/owning-the-block.html` to serve `/insights/owning-the-block`; no Codex visual or semantic edits were made to the returned file. The local returned artifact is the correction source, not a new published URL. The integrity test binds all three hashes and compares the node, use-case, connector, and interaction source blocks with the protected original.

The Home Front Ledger HTML is not self-contained: it references two relative public scripts. Portfolio serves exact copies at the resolved same-origin paths. It also references D3 and TopoJSON from cdnjs and fonts from Google; those external URLs remain unchanged in the source HTML.

| Relative script | Public source URL | SHA-256 |
| --- | --- | --- |
| `world.js` | https://home-front-ledger.vercel.app/home-front-ledger/world.js | `d95f9918811930b46ee8410eff93ad8e0224ec5b9821665888e03df00fb0303a` |
| `data.js` | https://home-front-ledger.vercel.app/home-front-ledger/data.js | `8ca754cf08986941524b909366e325f24016608c8ff3260a773d2d9df47ad40b` |

To verify the checked-in source files, run `shasum -a 256 public/insights/equity-code/*` and compare the tables above. Any correction to a dashboard should first be made in Claude's authored source and then re-imported with a new recorded hash.
