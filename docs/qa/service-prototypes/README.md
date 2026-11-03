# Six service prototype evidence

These 18 gallery images are captures of the six interactive routes at `/service-prototypes/[slug]`, three views per service. `capture-manifest.json` records the exact local route for every frame. Names, activity, and business records in the prototypes are synthetic. The interactions run in browser memory and do not call providers, send messages, or write customer data.

## Source map

| Surface | Source and treatment |
| --- | --- |
| Website UX Refresh | The existing KinFlo-built Julie capture at `public/showcases/service-digital-review/website-ux-refresh-kinflo-built-example-r1.jpg` is presented in the local responsive prototype. Its provenance and capture route are documented in `docs/showcase-audit/qa/services/final-gallery-integration-qa.md`. The mobile program path is a local presentation, not a claim about the hosted Julie site. |
| Accelerated Cohort and self-paced course | The course module sequence and the Signals / Alignment / Momentum exercise follow `docs/accelerated-course-modules/module-production-packets.md` and the Accelerated course kit. The guided lesson is a text-based interactive preview; no recorded lesson is claimed. |
| Chatbot, workflow, and masterclass | These are synthetic product demonstrations drawn from the service descriptions and local design work. They do not represent an active client account or a live provider integration. |
| AmaduTown shield | `public/amadutown-logo-upscaled.png`, used at its portrait aspect ratio. |

`scripts/qa/capture-service-prototypes.mjs` regenerates gallery and responsive screenshots from a local server. `scripts/qa/record-service-prototypes.mjs` records the three views of each service. The final H.264 MP4 is `service-prototypes-walkthrough.mp4`.

## Review limits

The local previews demonstrate interaction and layout. They do not authenticate, persist data, stream a class, issue a real certificate, send a lead, or contact an external service. The self-paced player uses guided text segments because no approved course video is bound to this service.
