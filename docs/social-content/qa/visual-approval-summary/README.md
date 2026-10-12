# Social Content visual approval summary QA

Production-equivalent fixture route:

`/admin/social-content/deterministic-visual-binding-qa?step=visuals&qa=visual-approval-summary&qa_state=approved`

The fixture carries a current, version-bound provider-none render receipt and an explicit approved `visual_assets` decision. It does not read or write the production Social Content record.

## Coverage

- Viewports: 390 x 844, 768 x 1024, and 1440 x 1000.
- Themes: light, dark, and system (resolved light in the capture environment).
- Approved-state agreement: sticky current-review header, Amina Visuals step, visual decision panel, receipt, and next action.
- Reload: the exact approved fixture route retains the same projection.
- Fail-closed recovery: the stale fixture remains pending, disables visual approval, and exposes `Render updated visual`.
- Safety: zero external requests and zero mutation requests in every recorded context.

`results.json` contains the machine-readable matrix. `social-visual-approval-summary-walkthrough.mp4` concatenates all nine review contexts on a stable 1440 x 1024 canvas.
