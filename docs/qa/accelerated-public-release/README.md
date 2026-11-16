# Accelerated public release and services connection review

This package records the public-route review for the Accelerated release connection and the unified Services catalog.

## Scope

- The homepage publication card routes directly to `/accelerated`.
- The homepage Services section and `/services` share the current service-gallery and prototype image pipeline.
- Accelerated and Agentified appear as flagship workshops on both routes.
- The workshop cards use current raster artwork from their standalone public pages.
- Mobile leads with the workshop image before supporting copy.

## Reproduction

```bash
MOCK_N8N=true N8N_DISABLE_OUTBOUND=true npm run dev -- -p 4311
ACCELERATED_RELEASE_BASE_URL=http://127.0.0.1:4311 \
  ACCELERATED_RELEASE_REVISION=accelerated-public-release-services-v3 \
  node scripts/qa/record-accelerated-public-release.mjs
```

## Validation

```bash
npm test -- components/FlagshipWorkshops.test.tsx components/Services.showcase.test.tsx lib/accelerated-publication.test.ts lib/agentified-publication.test.ts app/accelerated/page.test.tsx
NODE_OPTIONS=--max-old-space-size=8192 npm run build
```

- Focused tests: 13 passed.
- Production build: passed; existing unrelated lint and environment warnings remain.
- Desktop walkthrough SHA-256: `cd13a55eb349e793295ace82003122dd9848fd389bc8a8dc90c5128dc1fb30c4`
- Mobile walkthrough SHA-256: `d0d7d148412e558c6eaca10a6f824aca906b91a9db8b19ddb814fa100596ae8b`
- Both walkthrough MP4s passed full decode.

No learner media, provider, billing, credential, database, or production-data state changed during this review.
