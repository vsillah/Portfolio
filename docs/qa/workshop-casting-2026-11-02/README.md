# Workshop gallery casting QA

Product revision: `ef5f5782` (`codex/workshop-services-casting-gallery`).

Local review used `PORT=3211 npm run dev` with nonfunctional Supabase client placeholders, `MOCK_N8N=true`, and `N8N_DISABLE_OUTBOUND=true`. The read-only proxy at `127.0.0.1:3212` supplied the checked-in public service catalog snapshot for `/api/services` and `/api/services/:id`. No production data or customer information was used.

Exact review routes:

- `http://127.0.0.1:3212/services?type=workshop&rev=ef5f5782` for the three services typed as workshop.
- `http://127.0.0.1:3212/services?rev=ef5f5782`, with `workshop` entered in search, for all five workshop and cohort offers.
- `http://127.0.0.1:3212/services/cd2c086a-26ec-4637-b7a3-129021c0bc19?rev=ef5f5782` for the Accelerated detail gallery.

The screenshots cover hero and secondary frames at desktop 1440 px, tablet 820 px, and mobile 390 px, in light and dark themes. The cohort detail gallery was checked at desktop and mobile widths. The gallery's next button and direct second-frame control both advanced to `Image 2 of 2`; the full five-card search returned `Showing 5 of 41 services`. Visual review found no visually apparent repeated face across frames, malformed hands or devices, baked-in legible text, gallery clipping, or service-scene mismatch. The visuals are illustrative concepts, not documentary evidence of a real workshop.

Validation: `npx vitest run lib/service-gallery.test.ts lib/service-photographic-gallery.test.ts lib/workshop-gallery-casting.test.ts` passed 10 tests. `npx tsc --noEmit` failed on existing unrelated test typing errors and the absent `lib/chatbot-knowledge-content.generated` module; none of the errors names the new casting test or gallery files. A full build was not claimed.

Ten bounded image generations were made using the built-in image generation tool. The source and per-frame casting intent are recorded in `workshop-casting-matrix.json`, with resulting JPEG hashes in the asset inventory and gallery audit. No paid API call or purchase was made by this lane; observed incremental provider spend was US$0, below the US$9 cap. The built-in tool did not return a metered billing receipt.

The 1280×720 H.264 MP4 walkthrough is `workshop-gallery-walkthrough-ef5f5782.mp4`. Rebuild it from these screenshots with `node docs/qa/workshop-casting-2026-11-02/make-walkthrough.mjs`.
