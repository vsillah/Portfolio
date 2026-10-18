# Jev YouTube Shorts packaging evidence QA

- UI revision: `a96a32270934f8d638203b22aaa9f343bcbea627`
- Route: `/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef`
- Fixture: `qa_fixture=channel_native_video_v2`
- Viewports: desktop `1440x900`; mobile `390x844`
- External actions enabled: `0`

The bound state shows the current title, `AI Scored It 81%. Who Makes the Call?`, beside the exact 1280x720 Jev thumbnail. Its title and thumbnail scorecards pass the unchanged 75/100 threshold. The expanded evidence preserves eight actual public Shorts thumbnails, source URLs, exact observed metrics, channel/audience/recency normalization, six exclusions, recurring traits, adopted traits, rejected traits, and the composition decision.

The missing-thumbnail fixture still fails closed with a specific recovery action. Provider generation, upload, platform-draft creation, scheduling, publishing, credential changes, privacy-boundary changes, and external sends remain disabled.

Validation:

- `107/107` focused route, evidence-component, and packaging tests passed.
- Scoped Next.js lint passed with no warnings.
- Desktop and mobile rendered checks found no horizontal overflow.
- The MP4 is H.264, `1440x900`, 25 fps, 208 frames, and 8.32 seconds. SHA-256: `bea2fc37d650273f481964c80f64f9b94135c06f7e82ed267543fdbcb43e2297`.
- The repository-wide `npx tsc --noEmit` remains blocked by pre-existing unrelated test-fixture errors outside this change; no new errors appeared in the focused test or lint scope.
