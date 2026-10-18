# Jev YouTube Shorts packaging evidence QA

- UI revision: `f1b139d8`
- Exact localhost route: `http://127.0.0.1:3128/admin/social-content/f966123f-05eb-48ec-a7c2-970afce642ef?step=visuals&review=desktop&qa_fixture=channel_native_video_v2&video_package_state=ready&packaging_state=bound&rev=f1b139d8`
- Fixture: `qa_fixture=channel_native_video_v2`
- Viewports: desktop `1440x900`; mobile `390x844`
- External actions enabled: `0`

The bound state shows the customer-facing title, `AI Scored It. Who Makes the Call?`, beside the exact `1080x1920` Jev Short candidate. The candidate uses approved first-party Vambah imagery, an approved Jev product-proof crop, a short tension hook, and AmaduTown brand treatment.

The expanded visual-neighbor comparison separates three approved first-party AmaduTown baselines, the Jev candidate, and two formula-qualified public outliers. The public outliers are explicitly labeled comparison-only and contribute zero candidate design-fit points. Subject, hook, product proof, aspect ratio, and brand treatment each have a visible source binding, limitation, and verified/openable absolute link.

The missing-thumbnail fixture still fails closed with a specific recovery action. The regression suite also fails closed for a landscape candidate, a missing element binding, a blocked source link, and an unsupported claim that a public outlier supports the candidate composition. Provider generation, upload, platform-draft creation, scheduling, publishing, credential changes, privacy-boundary changes, and external sends remain disabled.

Validation:

- `126/126` focused route, evidence-component, manifest, and packaging tests passed.
- Scoped Next.js lint passed with no warnings.
- Desktop and mobile rendered checks found no horizontal overflow.
- The MP4 is H.264, `1440x900`, 25 fps, 281 frames, and 11.24 seconds. SHA-256: `4273e81486da0d88c10fa63994fef3e36e78688d519bfd6d98d388103fddd5bb`.
- Repository-wide `npx tsc --noEmit` remains blocked by pre-existing unrelated test-fixture errors outside this change; no new errors appeared in the focused test or lint scope.
