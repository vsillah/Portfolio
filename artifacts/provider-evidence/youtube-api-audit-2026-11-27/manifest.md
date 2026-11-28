# YouTube API Services provider evidence manifest

Status: review-only; not uploaded; provider form not submitted.

## Production binding

- Deployment: `dpl_EvCcNnSyc6bsYNkgUSPVr3Hx3Wzo`
- Exact merge commit: `9b980986d9e45b999b5092eaa58813221111048e`
- Public-metadata collection: inactive
- Derived scoring: inactive

## Evidence inventory

| Evidence | Route | Capture time (EST) | Dimensions | SHA-256 |
| --- | --- | --- | --- | --- |
| Homepage YouTube API Services disclosure | `https://amadutown.com/` | 2026-11-27 7:14:40 PM | 2414 x 1880 | `e74e3be9a4f268a489bc9df4da1aeee33c2143055f7156175e8ff2b0176b5d4d` |
| Privacy Policy - YouTube public metadata | `https://amadutown.com/legal/privacy` | 2026-11-27 6:31:02 PM | 3142 x 2212 | `f609919d8d5c463f1a3501283da7f479ca478ac796e79ff084ba0f9e6dfffd95` |
| Data Deletion - public YouTube metadata | `https://amadutown.com/legal/data-deletion` | 2026-11-27 6:21:10 PM | 3142 x 2212 | `35447730c8dff17e6e96ba4cba835139f5988af4af20eeef5bfc68509269655f` |

## Assembled review artifact

- File: `output/pdf/amadutown-youtube-api-provider-evidence-2026-11-27.pdf`
- Size: 1,367,147 bytes (1.3 MB)
- Pages: 4
- SHA-256: `113b3f1472bdbb095023fab120a8b6a67c9551f7e199b8d6754d14482e305ec3`
- Format checks: unencrypted; no AcroForm; no JavaScript; no embedded credential material

## Internal-tool workflow evidence

- Screencast: `screencast/portfolio-youtube-internal-workflow.mp4`
- Screencast scope: approved Jev fixture, title and thumbnail evidence, source and exclusion review, architecture, user flow, and the locked provider boundary
- Screencast SHA-256: `e8b543c13e0568d651f75a1ad99fe7ddb3d32c6ed5d976c43e6173b5cb76c20b`
- Receipt: `screencast/receipt.json`
- Architecture: `diagrams/portfolio-youtube-architecture.svg` (`9d0a289008e5e5b9c26bb9cce3ab2cb3b62663b8820331f0cd27d817eb387406`); PNG `52deeec66a86a4b951251de5b743fc188a7f56ac8d88c20ee0a43404a69cff45`
- User flow: `diagrams/portfolio-youtube-user-flow.svg` (`20f475e38513c8d28eabe4c7f2836e0e66f5b2a690340711a5c3ee29eef02fa3`); PNG `0b4685df554337a89c08079739390ff2372fad964ff3d5ff202858a54e06fb84`
- Upload-ready PNGs are stored beside each SVG; the SVG remains the accessible, editable source artifact.
- Rendered fixture state: `Pair binding passed · scoring hold`
- Network control: all non-local requests and all write requests were blocked by the recorder; zero external request and zero local write completed.
- Truth boundary: the recording demonstrates the existing internal workflow and its fail-closed handoff. It does not claim or simulate a completed live YouTube upload.

## Scope and exclusions

- The captures show production URLs in the browser address bar and the applicable YouTube disclosure or legal language.
- The homepage disclosure states that the proposed public-video-metadata and derived-metrics use is under review and inactive.
- No OAuth credential, access token, refresh token, client secret, CAPTCHA response, provider attestation, or private account data is included.
- The evidence has not been uploaded to Google or YouTube.
- The audit form has not been submitted.
- No amendment has been accepted and no evidence-processing policy has been activated.

## Rollback and handling

- Remove the assembled review PDF from the provider form before submission if any source hash or production binding changes.
- Re-capture and re-hash any page whose visible copy, route, deployment, or review status changes.
