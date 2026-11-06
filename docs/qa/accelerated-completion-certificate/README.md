# Accelerated completion certificate visual QA

Commit: `6d6bbd58`

Local fixture: `http://localhost:3100/member/dashboard?qa=completion-ready&rev=6d6bbd58`

- Inspected the unclaimed certificate in light and dark themes at desktop width, plus light theme at 390px mobile width. The ornate border, issuer area, and bottom-right owner/author line remained visible without clipping.
- Used the development-only `completion-ready` fixture to claim a certificate for `Course Learner`. No database row or real learner credential was created.
- Downloaded the dark SVG, validated its XML with `xmllint --noout`, rendered it with `sips`, and visually inspected the result in `downloaded-dark-6d6bbd58.png`. The source SVG included the current theme colors, AmaduTown shield, learner name, date, and unsigned owner block.
- Focused Vitest: 5 tests passed. Production build passed before the final dark-gold contrast adjustment; focused Vitest passed again afterward. Both Vercel preview checks passed at the final head.
- No approved signature image was found in the Portfolio repo or AmaduTown Drive materials. Unrelated personal signature documents were excluded. The signature line remains blank; a real signature must be supplied and approved before this part of the request can be completed.
- Replacement MP4 remains pending. The browser tool rendered the exact route, but available system screen capture targeted a different foreground desktop, and window capture of the off-desktop Chrome window failed. A full-screen recording would expose unrelated material, so none was retained. Human QA should remain pending until a privacy-safe walkthrough of this commit is attached.
