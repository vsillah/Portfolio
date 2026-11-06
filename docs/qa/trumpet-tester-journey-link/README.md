# Trumpet Trainer tester journey QA

Source commit: `cc99fc6836f166e042c8f9f4fb7054211b782651`

Review route: `http://localhost:3187/work/trumpet-trainer?rev=cc99fc6836f166e042c8f9f4fb7054211b782651#interest`

The [desktop walkthrough](desktop-journey.mp4) and [mobile walkthrough](mobile-journey.mp4) show the interest section, the “See the tester experience” link, the destination, and the return link. The capture uses empty form fields and public product imagery.

`capture.mjs` checked the CTA at 360, 768, and 1280 px in light and dark mode. It verified one link, its destination, visible focus outline, no clipping or horizontal overflow, destination `noindex, nofollow`, no destination form, and return navigation. Matching screenshots are stored here.

Focused tests: `vitest run components/TrumpetInterestForm.test.tsx app/work/trumpet-trainer/page.test.tsx app/work/trumpet-trainer/recruitment/page.test.tsx` — 22 passed. Scoped ESLint passed. Full repository `tsc --noEmit --incremental false` remains red on unrelated existing files; it reported no error in the changed component or test.
