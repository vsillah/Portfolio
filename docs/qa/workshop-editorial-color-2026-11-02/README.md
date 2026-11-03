# In-scene workshop gallery review

- Product commit: `99e711c4` (base `e914ec4cdef91981dd5b45b2b43af88477da0a2e`).
- Exact localhost gallery: `http://127.0.0.1:3212/services?rev=99e711c4&surface=in-world-2`. Search `workshop` with All Services selected to show all five offers.
- Full-Day detail route: `http://127.0.0.1:3212/services/457da6b5-92db-4b5b-a895-ee8571a47c8c?rev=99e711c4&surface=in-world-2`.
- Data: read-only public service-catalog snapshot through `scripts/qa/service-showcase-proxy.cjs`; dummy Supabase URL and disabled outbound n8n. No authenticated or customer-data flow.
- Sources: the owned Accelerated ebook chapters and original SAM infographic, with exact chapter/member, excerpt or source crop, physical surface geometry, transforms, and source/artifact/output hashes in `source-to-service-visual-map.json`. Replacement scene photographs are fictional local images. No client case material or generated chart/map is visible.
- Visual check: `contact-sheet.jpg` shows all ten corrected frames with excerpt sheets, notes, laptop screens, or the original infographic placed on physical scene surfaces; faces and group interaction remain visible. Browser screenshots cover hero and second gallery frames at 1440 × 900, 820 × 900, and 390 × 844 in light and dark themes. Full-Day detail gallery was captured at mobile and desktop widths. The 390 px gallery has no horizontal overflow or clipped controls.
- Walkthrough: `workshop-editorial-color-walkthrough-99e711c4.mp4` uses exact-revision browser screenshots. FFprobe reported H.264, 1280 × 720, 780 frames, 32.5 seconds; a decoded frame was visually checked.
- Focused validation: `npx vitest run lib/workshop-source-bound-gallery.test.ts lib/service-gallery.test.ts lib/service-photographic-gallery.test.ts lib/workshop-gallery-casting.test.ts` — 14 passed. `git diff --check` passed.
- Broader validation: `npx tsc --noEmit` remains blocked by unrelated baseline errors, including a missing `chatbot-knowledge-content.generated` module and existing type errors in campaign, social, and video tests. No changed gallery source appeared in the errors.
- Scope limits: detail bundle API and purchase/quote completion were not exercised against the read-only fixture. No live workflow, deployment, or customer-data smoke was run.
