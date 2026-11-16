# Services gallery parity QA

This packet verifies that the approved service imagery resolves on environment-specific service records whose UUIDs differ from the production catalog.

## Scope

- `/services` desktop and 390x844 mobile card galleries
- `/services/[id]` desktop and 390x844 service detail gallery
- Stable exact-title fallback to the existing approved gallery records
- Unknown services remain fail-closed

## Validation

- All 41 approved catalog titles resolve the same two-frame gallery when called with an environment-specific ID.
- The exact local `/services` route reports zero `Service visual pending` cards across all 37 local records.
- The first local service detail route loads its approved gallery on desktop and mobile.
- Both MP4s decoded successfully after H.264 conversion.

## Review artifacts

- Desktop walkthrough SHA-256: `1ff87968a0ffdf886f416510bf32af835450e8980148670e147f3707ed1ff2e0`
- Mobile walkthrough SHA-256: `58058daf28d8544bd7b2806f5803261056b0b466f4e42a5c1d406c03ee5ec509`
- Desktop service grid SHA-256: `d0e8c7c44ff780bcc2f2d8afbad0e5e9b3bb3c8a17fac6e0bf44a81fc6084ad3`
- Mobile service grid SHA-256: `242b10f746ad3929f4121691f5e3af4410059168ac80bdf174ef470033a29847`

No database record, service image field, provider account, customer data, credential, billing setting, or production learner state was changed.
