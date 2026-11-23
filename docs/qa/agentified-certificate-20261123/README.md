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

## Achievement sharing extension

Commit `264095bb94bd8719edae311d161136f10c5f7c80` adds a share panel only after the credential is claimed. The full copy action uses a course-owned public message and `https://amadutown.com/agentified`; native Web Share sends the same outcome text and URL as separate fields where supported. LinkedIn and Facebook links carry only the canonical URL, with an explicit instruction to paste the copied message. X uses a shorter public outcome message and the same URL. No learner name, record ID, verification token, progress, or Operating File content enters any share payload. Nothing posts automatically.

`share/desktop-share-walkthrough.mp4` (SHA-256 `51f5c74dfdc2ce0199963111585e4d9fc094a5f5056133c524872945e483ef69`) and `share/mobile-share-walkthrough.mp4` (SHA-256 `62093347c1643b86e923524b3696c484d89570b0ffecb9bd964fc48a2d000087`) show the exact synthetic localhost route at 1280×800 and 390×844. Frames cover claimed and copied states, verified and revoked credentials, eligible unclaimed and blocked states; mobile also covers a long name. The screen-capture recipe is `scripts/record-agentified-certificate-share-qa.mjs`. The headless capture browser lacked native Web Share, so its button is absent in those MP4s; the live Chrome review tab displayed it, and focused tests exercise native success and cancellation. Both MP4s decoded successfully. No social composer was submitted and no real account was used.
