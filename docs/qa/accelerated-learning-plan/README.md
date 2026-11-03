# Accelerated Learning plan local QA

Reviewed implementation commit: `cb9fa070b43e3c7998660f33220344d43b44b4ee`.

Route: `http://localhost:5391/service-prototypes/accelerated-cohort?view=3&rev=cb9fa070b43e3c7998660f33220344d43b44b4ee`

The captures use the existing public cover, approved SAM plates, and four storyboard frames from `docs/accelerated-course-modules/visual-production/`. They show synthetic learner progress only. No provider media was generated or released.

Checked at 1440 × 900, 768 × 900, and 390 × 844 with no horizontal overflow. Exercised all act filters, search and empty recovery, L05 and L16 selection, completion and reversal, next lesson, and the disabled guided-video action. The mobile selection returns the viewer to the detail panel. `mobile-walkthrough.mp4` is a silent sequence of browser screenshots showing the initial plan, L05 storyboard, L16 synthesis, complete/locked state, and empty-search recovery. Rebuild it with `bash render-walkthrough.sh`.

Focused tests and curriculum/visual packet validators passed. `NODE_OPTIONS=--max-old-space-size=8192 npm run build` passed. The default 4 GB heap exhausted during an earlier build attempt; a standalone `tsc --noEmit` also reported existing errors outside this lane, including test fixtures and a generated knowledge file that the build creates. Captain review remains the gate before Human QA.
