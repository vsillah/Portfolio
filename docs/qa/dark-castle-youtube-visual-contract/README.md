# Dark Castle YouTube corrected visual review

The localhost-only Social Content Visuals fixture is `/admin/social-content/dark-castle-youtube-visual-contract-qa?step=visuals&qa_state=current`. It is a **draft review candidate**, not a persisted or approved production edit. The correction replaces invented sequence labels with the interface language visible in the three public gameplay captures: `Explore`, `Try vs computer`, `Play`, `Start game`, `Move guidance`, and `Notation`. The YouTube title remains `Dark Castle Chess: what the artifact makes visible`.

## Value shown by the captures

The Explore capture shows e4 in Notation and a `Try vs computer` action. The next capture shows Play with e4 still listed and a `Start game` prompt. The third shows Black's e5 reply in Move guidance and Notation. The product observation is that the prior move remains visible beside the next decision. The captures do not establish a measured learning outcome or a new gameplay mode.

## Version and approval boundary

The earlier production copy for Social Content record `21c492c2-9279-4e08-afc9-49207935a681` was approved at `2026-10-23T23:07:32.922112+00:00`, with copy version `ccd60d3154616a5705d86c575ef9ae1e40fd0550e03c6008c633b2824b6b3a81`. That approval does **not** cover this correction. The corrected fixture copy version is `7f0031e0f71a14f3a6cc1fae15348b4ade122886f3e4f08b663d85b566491c62`, and copy and visual approval are pending. The source evidence fingerprint remains `fnv1a:07f944bb` because the three public capture bytes and identities did not change.

The corrected 1920 × 1080 PNG has SHA-256 `7995aa700990e680cd0345c99233a6eaa82e6027fa4ae3f6efd46b72b4899fbb`. Its editable HTML and unchanged public capture files are in `artifacts/human-qa/dark-castle-youtube-visual-contract-2026-10-23/source/`. [source-receipt.json](source-receipt.json) records the source hashes, corrected copy version, PNG, and walkthrough. The original approved package remains untouched at `/Users/vambahsillah/Projects/Portfolio/artifacts/human-qa/dark-castle-youtube-visual-2026-10-23`.

The fixture and its hash-checked image route return 404 in Vercel preview and production. The exact production record remains without a deterministic visual contract. This corrected contract is accepted only for the read-only localhost fixture; a production binding remains blocked until a separate current-copy approval, visual review, and captain-controlled integration step. No provider call, shared-record write, upload, platform draft, schedule, publication, or external send is part of this PR.

## Review evidence

`artifacts/human-qa/dark-castle-youtube-visual-contract-2026-10-23/` contains rendered desktop (1440 × 900), mid-width (768 × 900), and phone (390 × 844) captures; current, missing, and stale contract states; the corrected copy preview; and `visual-gate-walkthrough.mp4`. The 24.5-second H.264 MP4 is 1440 × 900, has no audio, and has SHA-256 `ad4d48a419bffde7b1702b45de0aafe22df067b5a432837c3cd81f78687756bb`. `frames.txt` and `render-walkthrough.sh` reproduce the MP4 from the captured review states.
