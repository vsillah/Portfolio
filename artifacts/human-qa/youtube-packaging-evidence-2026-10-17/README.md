# YouTube packaging evidence QA

- UI revision: `4fdb2ee8e34993c34a52e69331e253013351e507`
- Route: `/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef`
- Fixture: `qa_fixture=channel_native_video_v2`
- Viewports: desktop `1440x900`; mobile `390x844`
- External actions enabled: `0`

The bound state shows the checked-in Jev customer-facing title and its exact versioned thumbnail together. Pair binding passes, while the overall asset-package gate correctly remains on scoring hold because the Jev title and thumbnail do not have attributable numerical cohort receipts.

The missing-thumbnail state removes only the rendered asset binding and verifies the explicit blocker and recovery path. It does not create, upload, publish, schedule, draft, or mutate a production record.

The MP4 is H.264, `1440x900`, 25 fps, and 17.48 seconds. `results.json` records the commit-bound URLs and artifact names.
