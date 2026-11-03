# Source-bound workshop gallery review

- Product commit: `8dbda79c` (base `e914ec4cdef91981dd5b45b2b43af88477da0a2e`).
- Exact localhost gallery: `http://127.0.0.1:3212/services?rev=8dbda79c&source=owned-3`. Search `workshop` with All Services selected to show all five offers.
- Full-Day detail route: `http://127.0.0.1:3212/services/457da6b5-92db-4b5b-a895-ee8571a47c8c?rev=8dbda79c&source=owned-3`.
- Data: read-only public service-catalog snapshot through `scripts/qa/service-showcase-proxy.cjs`; dummy Supabase URL and disabled outbound n8n. No authenticated or customer-data flow.
- Sources: the owned Accelerated ebook chapters and SAM infographic, with exact chapter/member, labels, source and output hashes in `source-to-service-visual-map.json`. The two replacement background photos for Full-Day and Product Innovation secondary frames are fictional image generations; their analysis callouts remain derived from the owned ebook. No client case material or generated chart/map is visible.
- Visual check: `contact-sheet.jpg` shows all ten source-bound frames. Browser screenshots cover hero and second gallery frames at 1440 × 900, 820 × 900, and 390 × 844 in light and dark themes. Full-Day detail gallery was captured at mobile and desktop widths. The 390 px gallery has no horizontal overflow or clipped controls.
- Walkthrough: `workshop-editorial-color-walkthrough-8dbda79c.mp4` uses exact-revision browser screenshots. FFprobe reported H.264, 1280 × 720, 780 frames, 32.5 seconds; a decoded frame was visually checked.
- Focused validation: `npx vitest run lib/workshop-source-bound-gallery.test.ts lib/service-gallery.test.ts lib/service-photographic-gallery.test.ts lib/workshop-gallery-casting.test.ts` — 13 passed. `git diff --check` passed.
- Broader validation: `npx tsc --noEmit` remains blocked by unrelated baseline errors, including a missing `chatbot-knowledge-content.generated` module and existing type errors in campaign, social, and video tests. No changed gallery source appeared in the errors.
- Scope limits: detail bundle API and purchase/quote completion were not exercised against the read-only fixture. No live workflow, deployment, or customer-data smoke was run.
