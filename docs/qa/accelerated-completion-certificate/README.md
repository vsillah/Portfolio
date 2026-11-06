# Accelerated completion certificate visual QA

Draft PR: #1220, branch `codex/accelerated-completion-workspace`.

Review fixture: `http://localhost:3158/member/dashboard?qa=completion-ready&rev=credential-signature`. The fixture uses a fictional signed-in member profile and does not create a database credential.

## Approved treatment

- The certificate uses an ivory security-paper texture, navy-and-gold engraved framing, guilloche linework, and African-inspired geometric and wisdom-knot motifs.
- The AmaduTown shield preserves its portrait aspect ratio. Formal Roman serif typography keeps the credential legible; no cursive display text is used.
- Learner name, issue date, credential record ID, verification reference, title, and course details remain dynamic. The frame is stable artwork rather than a text-bearing certificate image.
- The unclaimed credential prefills the member profile name and keeps it editable until the member claims the immutable credential.
- The owner block uses Vambah Sillah's approved signature with its scan background removed, above the typed owner and author attribution.
- The central title and recipient block is intentionally lowered, while the issue, owner, and verification band remains clear of the lower frame.
- The issue-date and credential-record blocks use matching left and right frame insets.
- The responsive browser certificate and downloadable SVG use the same approved frame and hierarchy.

## Evidence

- `profile-name-prefill.png`: unclaimed desktop credential with its name supplied by the synthetic member profile.
- `approved-frame-desktop.png`: claimed desktop certificate from the exact localhost fixture.
- `approved-frame-mobile.png`: claimed 390px mobile certificate from the same fixture.
- `approved-frame-download.svg`: actual downloaded certificate export.
- `approved-frame-download.png`: exact 1424x1104 browser render of the downloaded SVG.
- `certificate-approved-frame-walkthrough.mp4`: privacy-safe H.264 walkthrough of the desktop, mobile, and downloadable outputs.
- `capture-approved-frame.mjs` and `render-approved-frame-walkthrough.sh`: reproducible capture and walkthrough commands.

## Validation and boundaries

- Focused credential, API, and verification-route tests: 10/10 passed.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run build`: passed, including 140/140 static pages. The default 4GB Node heap reached its limit during page-data collection.
- The downloaded SVG passed `xmllint --noout`; its verification reference was checked for frame overflow.
- Certificate frame SHA-256: `37bf0de6734e2c3c238a0f28afb8dc96f61247449972af8a15d5f5e4421ca44c`.
- No real credential, learner data, assessment, provider call, social post, database mutation, or external send was used.
- Human QA and captain integration remain separate gates. Production migrations remain subject to their own authorization rules.
