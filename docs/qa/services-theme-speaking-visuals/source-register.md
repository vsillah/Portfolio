# Services theme and Speaking gallery source register

## Selected gallery assets

| Public asset | Source and method | Claim boundary |
| --- | --- | --- |
| `public/showcases/speaking/vambah-speaking-illustrative-hero.jpg` | Built-in image generation, using the already approved `public/speaking/vambah-profile.jpg` only as Vambah's identity reference. The source portrait originated at AmaduTown Drive `Artifacts /Company Materials/Profile Photo.jpg`. | Photographic-style illustrative concept of a presentation, not documentation of a real event, client, audience, or venue. |
| `public/showcases/speaking/vambah-speaking-illustrative-qa.jpg` | Built-in image generation with the same approved identity reference; distinct Q&A composition. | Photographic-style illustrative concept, not evidence of a past engagement. |

Final SHA-256: hero `cb7da888ac14dae7bcf282a3410d9d23deebb8ae4d563a7fd2520f5adf3404ed`; Q&A `229caaa71f496b0e99836346e9cf5b5d8dfdbbac133d178d753affc8f91f8b5a`.

The gallery labels and alt text identify both frames as illustrative. The files are JPEG raster images, with no SVG or abstract poster in the active Speaking Engagement gallery. The original generated PNGs are `/Users/vambahsillah/.codex/generated_images/01a19dba-634f-7a63-b8af-c4ae83a045fe/exec-c4e06760-9235-469b-912e-39d99573a6a7.png` (hero) and `/Users/vambahsillah/.codex/generated_images/01a19dba-634f-7a63-b8af-c4ae83a045fe/exec-3683b743-c2c8-4d9a-8ab0-b8e636bf6dbd.png` (Q&A); the public JPEGs are the project deliverables.

## Search and rejection

- Portfolio `public`, `docs`, and `design-files` and the AmaduTown Google Drive `2. AmaduTown Advisory Solutions` tree were searched for approved speaking, stage, event, workshop, conference, and presentation photos.
- `public/speaking/vambah-profile.jpg` is an approved company portrait. Its existing source register explicitly says it does not depict a speaking event, so it was used only as an identity reference.
- Other available Vambah portraits and YouTube thumbnail subjects did not depict an attributable speaking event. The existing two Speaking Engagement gallery frames were illustrations and were replaced.
- Public web image search returned the approved AmaduTown portrait and unrelated speakers, with no attributable Vambah event image selected.

## Generation prompts

Hero: Preserve the approved portrait's adult facial identity, skin tone, hairstyle, and proportions. Show Vambah presenting and gesturing to a small audience in a modest event room, with natural warm light and one coherent candid camera view. Avoid text, logos, specific clients, and documentary claims.

Secondary: Preserve the same identity in a distinct candid Q&A view, with Vambah holding a microphone and responding to an audience member after a talk. Show a modest room, natural light, and one coherent camera view. Avoid text, logos, specific clients, and documentary claims.

Both were generated as photorealistic illustrative concepts with the built-in `image_gen` tool, then converted from PNG to JPEG with `sips -s format jpeg -s formatOptions 85`. No production service record was changed.

## Consulting and workshop extension (2026-11-02)

The public catalog snapshot contains 31 qualifying services (`service_type=consulting`, `service_type=workshop`, or a workshop/cohort title). The [per-record audit](service-gallery-audit.json) records each original pair and decision. Website UX Refresh remains bound to its named built example and matching review artifact. Thirty galleries were replaced: five workshop/cohort offers and 25 other consulting records. AI Inbound Lead Chatbot was reclassified during the final visual pass because its robot-led hero looked like generic AI stock art.

The repo and AmaduTown Drive asset search found existing editorial mockups, prototype boards, course/workshop slide exports, and some client project materials. No directly reusable approved photographic pair covered these 30 offers. The client/project materials were not repurposed as general service marketing photography. The approved Vambah portrait was referenced only for the two Management Consulting frames; no other new gallery depicts him.

The 60 final JPEGs are under `public/showcases/service-photographic/`. [Asset inventory](asset-inventory.json) records every exact public path, SHA-256, dimensions, source PNG, and crop rectangle. [Generation source map](generation-source-map.json) records the original image-generation outputs and scene briefs. [Preparation script](prepare-gallery-assets.mjs) deterministically converts the eight individually generated pairs and crops the two independent panels of each approved contact sheet. The contact sheets have a neutral gutter and separate scenes; no final gallery reuses a photo or a crop. [Binding script](bind-gallery-assets.mjs) applies the reviewed pair to each exact service ID without changing service records.

Each frame's visible gallery label, status, and alt text identify it as an illustrative scene. Laptop-based participation is visible in every workshop pair, including the self-paced recorded offer's solo learner setting. Management Consulting shows a private one-on-one decision session in two distinct views. Consulting scenes use small working sessions, source review, support, templates, or offer-specific artifacts. The images do not establish that any depicted event, client engagement, provider capability, result, or product interface actually occurred. Early candidates with invented readable email or migration content were rejected and are absent from the final bindings.

No paid image-provider purchase, production data write, deployment, publishing, or external send was performed.
