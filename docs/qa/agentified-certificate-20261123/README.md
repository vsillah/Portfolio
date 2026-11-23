# Agentified completion certificate parity review

Draft PR #1304 remains stacked on draft PR #1302. This packet replaces the earlier, plainer Agentified certificate evidence. All review states use a synthetic learner and the development-only member dashboard fixture.

## Design checkpoint

`parity-side-by-side-desktop.png` and `parity-side-by-side-mobile.png` place the approved Accelerated certificate on the left and the Agentified certificate on the right. Both use the unchanged, approved `public/accelerated/certificate-frame.png` (SHA-256 `37bf0de6734e2c3c238a0f28afb8dc96f61247449972af8a15d5f5e4421ca44c`) and the same fixed-ratio composition. Agentified keeps its own workshop wording, course title, teal ink/accent, signature attribution, and display-safe record reference. Accelerated's rendered markup, CSS, and frame were not changed; its download now reads the shared frame-path constant.

## Review routes and evidence

Use `http://127.0.0.1:3189/member/dashboard?qa=agentified-credential&certificate=claimed&certificateTheme=system&rev=<commit>` after restarting this worktree's localhost server from `<commit>`. Synthetic states are `blocked`, `eligible`, `claimed`, `verified`, `revoked`, and `long-name`. `certificateTheme=light` or `dark` sets only the development preview theme; omit it or use `system` for the browser preference.

- `desktop-certificate-walkthrough.mp4`: blocked, eligible, claimed, verification on, verification off, downloaded artwork.
- `mobile-certificate-walkthrough.mp4`: the same workflow through verification off, then a long learner name at 390×844.
- `parity-desktop-*` and `parity-mobile-*`: exact-route captures of the named states and light, dark, and system theme views. `accelerated-regression-*` shows the untouched Accelerated fixture on this branch.
- `approved-frame-download.svg` is an actual browser download at 1424×1104. `approved-frame-download.png` is its rendered raster inspection copy.

The MP4s sequence exact-route captures as timed, silent states; each decoded cleanly and sampled frames were visually inspected. The browser download passed `xmllint --noout`, embeds the frame, shield, and signature, and contains no raw verification token, access token, or service-role value. Its public record label is derived from immutable claim fields and cannot authorize verification. The certificate describes workshop completion and does not imply professional accreditation.

No real learner record, customer account, credential issuance, database mutation, provider call, external share, production canary, merge, or release was used in this lane. Captain review and Human QA remain pending.
