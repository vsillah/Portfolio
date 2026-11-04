# Accelerated L03 learner binding QA

Route: `/service-prototypes/accelerated-cohort?view=3` on this branch's localhost server. Screenshots were captured in the integrated browser from the actual learner route at desktop and 390×844 mobile widths. `render-walkthrough.sh` assembles them into the privacy-safe MP4.

## Exact lineage

- L03 composite SHA-256: `02b9c3ea941c22ffaf87b3bc4e4c4612951499af15485e0261910fad6014053a`
- Approved native source SHA-256: `064e049bfaee6d60d5d811d516dbcdf9c14466602afef9a34e07cbf31c551198`
- Approved caption SRT SHA-256: `ee59adb3cd88e195c25bebaeb04ca0f9b78cc42c7291b1300b205f5958a917de`
- Script SHA-256: `41d9233ab15a1922748e455da8d31af1c33f356a4f569740121526a92cce8f6e`
- Source commit: `7663edf66b7eb6c88d7129ae331199616ae44345`

The learner VTT and transcript are deterministic derivatives of the exact approved SRT. The staging check fails if the composite, source lineage, SRT, script, receipts, or unchanged L01/L02 media do not match. No media was transcoded for the learner binding.

## Rendered checks

- Desktop: L03 ready, native player loaded and playing, English captions showing, transcript expanded, return to plan, L04 disabled.
- Mobile 390×844: player and captions visible, transcript readable, no horizontal document overflow.
- Browser media metadata: 540 seconds, 1920×1080, `readyState=4`.
- L04–L16 remain locked; L01/L02 paths and byte hashes are unchanged.

No provider call, upload, publication, distribution, external send, production-data mutation, or spend occurred.
