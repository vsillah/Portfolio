# Agentified Phase 4 integration

This package binds only the distribution-qualified Agentified lessons from qualified tree `9f70b89002603b3100c42d062b064b9386c2f399`.

## Bound scope

- L01 and L05–L16 have versioned desktop and 390×844 media, captions, source hashes, and build receipts.
- L07, L08, and L16 incorporate the exact caption-free presenter candidates and retained-source receipts approved at PR #1296 head `92bcc37c1eeb19f275b97fea8e647e9ae7376145`.
- L13 incorporates the qualified `unknown` audio-join candidate without changing its duration or caption timing.
- L09 uses the qualified external VTT correction from `approve` to `approved`; its cue window is unchanged.
- Responsive framework studies use the Phase 3B scene-exact timing receipts. The base audio and subtitle streams are copied unchanged.

## Fail-closed exclusions

L02–L04 remain available as lesson transcript and Operating File worksheet states, but their guided videos are unavailable. Phase 3 found no complete, qualified whole-lesson audio for those lessons, and the owner release covers only L01 and L05–L16. This integration does not substitute the older incomplete media.

## Reproduction and validation

- Build: `python3 scripts/qa/build-agentified-qualified-media.py`
- Binding verification: `node scripts/verify-agentified-qualified-binding.mjs`
- Generated receipt: `media-build-receipt.json`
- Runtime manifest: `lib/agentified-qualified-bindings.json`

The integration remains draft and does not authorize merge, deployment, publication, or release.
