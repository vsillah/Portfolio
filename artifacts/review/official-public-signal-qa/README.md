# Official public signal operator QA

Route: `/admin/social-content?officialQa=public-signal-v1` on the branch localhost server. This development-only synthetic fixture renders the same Launch evidence operator component with all writes disabled and no live source read. The normal `/admin/social-content?workflow=evidence` path stays behind Portfolio admin authentication.

The screenshots were captured from the integrated Codex browser at desktop (1280 × 720) and phone (390 × 844) widths. The MP4 is a 12-second walkthrough assembled from those actual browser captures: pending Unscored packet, expanded exact source receipts, and the narrow-width observation intake form. The final MP4 was decoded with FFmpeg and probed with FFprobe. `render-walkthrough.sh` reproduces it from the captured frames.

Evidence boundaries: synthetic values, no production collection, no database write, no packet approval, no candidate reconciliation, no provider call, and no publication action. The admin route and the real evidence path are validated by focused route and component tests; the fixture demonstrates rendered layout and controls only.
