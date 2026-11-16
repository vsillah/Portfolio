# L01 clean-master local review

One 345-second caption-free master was rendered on 2026-11-12 from the hash-bound v13 P01/C01/P02/C02 source. The approved J01 and copied AAC stream are unchanged. The optional 175-cue WebVTT remains in the v18 feasibility packet. This package is local review evidence; no learner media was rebound.

## Exact outputs

| Artifact | SHA-256 |
| --- | --- |
| Local `l01-c01-c02-v19-clean-master-review.mp4` | `7002f7d9ffe917294969e24a17d98459f9d700f319fa576f30613c63442a9e3f` |
| `../c01-c02-v18-optional-caption-feasibility/lower-captions.vtt` | `427376480d444d321513ddc09c226e7896967909d8baa790b1569dd4a79b508b` |

The MP4 is intentionally local and excluded from the PR because it contains the presenter's voice. `render-receipt.json` records source hashes, duration, frame count, full decode and encoded/decoded audio identities. `browser-review.json` records the actual-player desktop and 390×844 checks. Four decoded stills and the three-cut contact sheet are under `stills/`.

## Reproduce and inspect

From the Portfolio root, first verify the source and cue plan:

```bash
python3 -B artifacts/accelerated-visual-parity-2026-11-10/l01-j01-c01-c02-candidate/c01-c02-v19-clean-master-review/build-master.py preflight
```

`build-master.py render` refuses an existing output and is intended for one render in a fresh output directory. The existing local output can be checked with `build-master.py inspect`. For native browser playback, run `serve_range.py` in the same folder and open its printed localhost URL with `?rev=7002f7d9ffe9` appended.

## Review boundary

The four sections displayed the approved source art at 5, 174.4, 240.05, and 250 seconds. Optional captions were off by default, could be toggled, and cleared the artwork, presenter, and native controls at desktop and 390×844. The three join windows had identical decoded PCM hashes to the source. Independent listening was not performed. Pre-existing P01 and C02 illustration observations belong to the separate 98-scene audit; they were not used to alter this authorized render. Human QA, learner binding, merge, and release remain separate gates.
