# Agentified completion certificate review

Source branch: `codex/agentified-completion-certificate-20261123-r2`  
UI commit: `38bd52698c517989aff59df2829787ddaad9c8e3`  
Base: draft PR #1302 head `b7044f1c36caf044334f12aeacd28009384baa68`

The desktop and mobile MP4s sequence captures taken from the exact local member-dashboard route while exercising its synthetic certificate controls. No customer account, real learner record, verification token, provider, or production endpoint was used. The desktop capture is 1440×900 with the certificate card framed at 1024×1020. The mobile capture is at 390×844 and includes the long-name layout.

Review route: `http://127.0.0.1:3189/member/dashboard?qa=agentified-credential&rev=38bd52698c517989aff59df2829787ddaad9c8e3`

Append `&certificate=blocked`, `claimed`, `verified`, `revoked`, or `long-name` to inspect a state directly. The default route starts with an eligible, unclaimed preview. Claim, verification on/off, and download actions in this local QA mode change only browser state. The `blocked` fixture shows 15/16 in both the surrounding progress tile and certificate card.

Video order:

- Desktop: blocked, eligible, claimed, verification on, verification off, download confirmation.
- Mobile: blocked, eligible, claimed, verification on, verification off, long learner name.

The MP4s were encoded from the adjacent exact-route JPEG captures using the `*-frames.txt` manifests. They contain silent, timed state transitions; they do not depict real learner data. The downloaded SVG was separately opened and rendered at its native 1600×1100 viewBox. It embeds the approved shield and Vambah Sillah signature; inspection found no raw verification token, access token, or service-role value. It uses a stable display reference derived from the immutable claim fields, not a database key or authority token.

Validation: focused Vitest tests, TypeScript, production build, desktop and 390×844 rendered review, actual SVG download and raster inspection, MP4 probe and sampled-frame inspection. The production canary, live verification destination, external sharing, and authenticated issuance were outside this lane.
