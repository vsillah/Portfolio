# Jev YouTube Shorts packaging evidence QA

- UI revision: `ccb59dc1703a91ddd174490479409d907fed17f4`
- Route: `/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef`
- Fixture: `qa_fixture=channel_native_video_v2`
- Viewports: desktop `1440x900`; mobile `390x844`
- External actions enabled: `0`

The bound state shows the current title, `AI Scored It 81%. Who Makes the Call?`, beside the exact 1280x720 Jev thumbnail. Its title and thumbnail scorecards pass the unchanged 75/100 threshold using only displayed formulas and observed inputs. The expanded evidence preserves eight actual public Shorts thumbnails, source URLs, exact observed metrics, channel/audience/recency normalization, six exclusions, and per-source visual annotations. A score threshold of `>= 75` separates two outliers from six topical baselines; only the outlier subset determines adopted visual traits.

Candidate title and thumbnail results are labeled `Evidence-fit score` with an explicit disclaimer that they measure conformance to recorded packaging criteria rather than predicted click-through rate, views, or platform performance. Public-source cards retain `Normalized performance score` for their comparison metric.

The missing-thumbnail fixture still fails closed with a specific recovery action. Provider generation, upload, platform-draft creation, scheduling, publishing, credential changes, privacy-boundary changes, and external sends remain disabled.

Validation:

- `107/107` focused route, evidence-component, and packaging tests passed.
- Scoped Next.js lint passed with no warnings.
- Desktop and mobile rendered checks found no horizontal overflow.
- The MP4 is H.264, `1440x900`, 25 fps, 244 frames, and 9.76 seconds. SHA-256: `4447a638ea2a7d586a3ad5491e15ee0f032281d343644f5ad7c7cfaa1b303657`.
- The repository-wide `npx tsc --noEmit` remains blocked by pre-existing unrelated test-fixture errors outside this change; no new errors appeared in the focused test or lint scope.
