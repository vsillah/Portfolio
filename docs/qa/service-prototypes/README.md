# Six service prototype evidence

These 18 gallery images are captures of the six interactive routes at `/service-prototypes/[slug]`, three views per service. `capture-manifest.json` records the exact local route for every frame. Names, activity, and business records in the prototypes are synthetic. The interactions run in browser memory and do not call providers, send messages, or write customer data.

## Source map

| Surface | Source and treatment |
| --- | --- |
| Website UX Refresh | The existing KinFlo-built Julie capture at `public/showcases/service-digital-review/website-ux-refresh-kinflo-built-example-r1.jpg` is presented in the local responsive prototype. Its provenance and capture route are documented in `docs/showcase-audit/qa/services/final-gallery-integration-qa.md`. The mobile program path is a local presentation, not a claim about the hosted Julie site. |
| Accelerated Cohort and self-paced course | The course module sequence and the Signals / Alignment / Momentum exercise follow `docs/accelerated-course-modules/module-production-packets.md` and the Accelerated course kit. The guided lesson is a text-based interactive preview; no recorded lesson is claimed. |
| SAM infographic | Approved `agentified/source-assets/accelerated/accelerated-sam-infographic.png` (1136×944), staged unchanged at `public/showcases/service-prototypes/accelerated-sam-infographic.png`. It is byte-identical (SHA-256 `13ef37fb39a228c79253538174cd9b3d77f6c7e630e9929dfa99e6cfa97f45c6`) to AmaduTown Drive `Artifacts /Promotional /Accelerated Building Smarter Products with AI/Final/Accelerated_infographic.png`. The three focus images alongside it are direct source crops: Signals x=0–409, Alignment x=362–751, Momentum x=726–1135, all y=116–861. The full source remains available in the zoom dialog; no content was redrawn or removed from the overview. |
| Accelerated book cover | Existing `public/accelerated_cover_ebook.jpg` (1800×2700), recorded in `docs/showcase-audit/public-offerings-2026-10-22.json`. The AmaduTown Drive `Final/accelerated_ebook_cover.jpg` is also 1800×2700 and has the same composition but uses white subtitle and author lettering where the repo asset uses gold. The cohort hero uses the existing repo JPG at its natural 2:3 ratio. |
| Chatbot, workflow, and masterclass | These are synthetic product demonstrations drawn from the service descriptions and local design work. They do not represent an active client account or a live provider integration. |
| Masterclass instructor portrait | Existing public site asset `public/speaking/vambah-profile.jpg`, used in the session preview. This is an instructor identity cue, not a claim that a recorded masterclass is bound. |
| AmaduTown shield | `public/amadutown-logo-upscaled.png`, used at its portrait aspect ratio. |

`scripts/qa/capture-service-prototypes.mjs` regenerates gallery and responsive screenshots from a local server. `scripts/qa/record-service-prototypes.mjs` records the three views of each service, plus the cohort's focused SAM acts and full infographic zoom. The final H.264 MP4 is `service-prototypes-walkthrough.mp4`.

## Review limits

The local previews demonstrate interaction and layout. They do not authenticate, persist data, stream a class, issue a real certificate, send a lead, or contact an external service. The self-paced player uses guided text segments because no approved course video is bound to this service.
