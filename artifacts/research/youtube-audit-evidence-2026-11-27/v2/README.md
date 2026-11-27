# YouTube homepage evidence v2 — local review only

**Runtime source:** `471bfbaeeea5f5ec37d2ff74ac4a52b59cb68c45`, based on `2b690f5e24a72507e6ba07a9db9491c7853a6b46`. **Capture date:** November 27, 2026. This version supplements the immutable v1 audit packet; it does not replace or alter v1. The [manifest](manifest.json) binds the included files by SHA-256, with the manifest itself bound by Git.

The public homepage now places a Privacy Policy link and an accurate YouTube API Services disclosure together in a footer. It describes the connected AmaduTown channel workflows as current and the separate public-metadata/derived-metrics proposal as inactive. It claims no YouTube approval, endorsement, audit outcome, or new API authority.

## Included preview evidence

| Files | Mapping | Limit |
| --- | --- | --- |
| `homepage-preview-desktop.png`, `homepage-preview-mobile.png` | Audit form §5 homepage Privacy link and YouTube presentation | Local production-build viewport captures. They lack a browser address bar and are **not provider-ready**. |
| `homepage-preview-desktop.mp4`, `homepage-preview-mobile.mp4` | Human QA walkthrough | Isolated, logged-out recordings of the changed footer, keyboard focus, and Privacy Policy navigation. They are **not** proof of deployment. |
| `capture-preview.mjs` | Reproduction | Headless Chromium with fresh storage; allows only local GET requests and aborts all external and mutating requests. Requires the exact source build at `localhost:3187`. |

The captures contain only public site content. No account session, client ID, secret, customer record, provider response, or third-party creator media appears. The YouTube name is text describing a current service integration, not a logo or claim of affiliation. Source and capture rights are owned public Portfolio content. No redaction was required. The MP4s were checked as playable H.264 files; the preview images were visually inspected at desktop and mobile widths.

## Outstanding captain handoff

1. After separately authorized merge and deployment, use the Integration Captain's durable in-app browser to capture the **exact live homepage route with its browser address bar, Privacy Policy link, and YouTube disclosure visible together**. Verify no unrelated tabs, account identifiers, or private data are in frame. Bind the production URL, deployment ID, timestamp, redaction decision, rights status, and SHA-256 in a new manifest version. Do not relabel these local captures as production evidence.
2. Load the exact latest commit-bound localhost or preview route in that same durable in-app browser for Vambah's client-facing Human QA. The local isolated browser here cannot provide the required durable in-app tab. Keep Human QA pending until that handoff is prepared.
3. Keep the other v1 evidence gaps explicit, especially privacy-page address-bar capture and the provider's live upload-outcome requirement. Neither is resolved by this homepage change.

No audit form answer, checkbox, attestation, upload, provider write, production data write, collection, persistence, scoring, evidence linkage, scheduling, publication, notification, or spending occurred. Rollback is a revert of the homepage disclosure commit and this v2 evidence directory; no migration, runtime flag, credential, production row, or calendar count is affected.
