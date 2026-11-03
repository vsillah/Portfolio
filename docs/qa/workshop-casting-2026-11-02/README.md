# Workshop gallery casting QA

Product revision: `cfe0c073` (`codex/workshop-services-casting-gallery`). This revision replaces the rejected Full-Day hero and three additional frames flagged during the ten-frame anatomy and representation audit.

Local review used `PORT=3211 npm run dev` with nonfunctional Supabase client placeholders, `MOCK_N8N=true`, and `N8N_DISABLE_OUTBOUND=true`. The read-only proxy at `127.0.0.1:3212` supplied the checked-in public service catalog snapshot for `/api/services` and `/api/services/:id`. No production data or customer information was used.

Exact review routes:

- `http://127.0.0.1:3212/services?type=workshop&rev=cfe0c073` for the three services typed as workshop.
- `http://127.0.0.1:3212/services?rev=cfe0c073`, with `workshop` entered in search, for all five workshop and cohort offers.
- `http://127.0.0.1:3212/services/457da6b5-92db-4b5b-a895-ee8571a47c8c?rev=cfe0c073` for the revised Full-Day detail gallery.

The screenshots cover all five hero and secondary frames at desktop 1440 px, the secondary set at tablet 820 px and mobile 390 px in light and dark themes, and the revised Full-Day hero and secondary detail views at mobile width. The Full-Day detail secondary was also checked at desktop width. The gallery's next button and direct second-frame control advanced to `Image 2 of 2`; the full five-card search returned `Showing 5 of 41 services`. Full-size and card-crop review of all ten active frames found no visually apparent prosthetic or robotic-looking anatomy, malformed hands or devices, conspicuous medical-device tokenization, repeated face, baked-in legible text, gallery clipping, or service-scene mismatch. The visuals are illustrative concepts, not documentary evidence of a real workshop.

The isolated detail route also attempted its separate bundles API. That request failed against the intentionally nonfunctional Supabase placeholder. This review verifies the service gallery and visible card/detail layout, not bundle data, checkout, or quote submission.

Validation: `npx vitest run lib/service-gallery.test.ts lib/service-photographic-gallery.test.ts lib/workshop-gallery-casting.test.ts` passed 10 tests. `npx tsc --noEmit` failed on existing unrelated test typing errors and the absent `lib/chatbot-knowledge-content.generated` module; none of the errors names the new casting test or gallery files. A full build was not claimed.

Fourteen bounded image generations were made using the built-in image generation tool: ten active frames and four superseded frames. The active source and per-frame casting intent are recorded in `workshop-casting-matrix.json`, with resulting JPEG hashes in the asset inventory and gallery audit. No paid API call or purchase was made by this lane; observed incremental provider spend was US$0, below the US$9 cap. The built-in tool did not return a metered billing receipt.

The 1280×720 H.264 MP4 walkthrough is `workshop-gallery-walkthrough-cfe0c073.mp4`. Rebuild it from these screenshots with `node docs/qa/workshop-casting-2026-11-02/make-walkthrough.mjs`. Current QA artifacts contain only the revised image set.
