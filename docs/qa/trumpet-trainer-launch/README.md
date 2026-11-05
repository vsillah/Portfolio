# Trumpet Trainer Portfolio launch review

Route: `http://localhost:3217/work/trumpet-trainer?qa=portfolio-launch&rev=274b3bff1291c526884e9dae7a59ffa66d96d485` on local port 3217 from `codex/trumpet-trainer-portfolio-launch`. The review build used `NEXT_PUBLIC_APP_ENV=production`, `MOCK_N8N=true`, and `N8N_DISABLE_OUTBOUND=true`. The in-app browser was loaded on this exact revision query after the build; the rendered hero showed the real product screen and no development banner.

The local review used inert Supabase placeholders with outbound n8n disabled. No production data was queried or changed. `QA_REV=274b3bff1291c526884e9dae7a59ffa66d96d485 node scripts/qa/trumpet-trainer-launch.mjs` checked HTTP 200, all seven carousel screens via next control, keyboard and direct selection, video controls and HTTP 200 asset, comparison copy, horizontal overflow, hero CTA, required adult confirmation, blocked child school/name/exact-age examples, permitted educator school context, email-draft state, the back link, and the Work card at 360, 768, and 1280 px. The email-draft link was inspected, not opened or sent.

Screenshots: `route-360.png`, `route-768.png`, `route-1280.png`.

Walkthroughs: `walkthrough-360.mp4`, `walkthrough-1280.mp4`. Both use synthetic adult test data and show the real gameplay carousel, confirmation, blocked, and ready states. They are playable H.264 MP4 files (11.00 and 12.96 seconds). The product capture itself is in `public/showcases/trumpet-trainer/c19989a3/gameplay-landscape.mp4` and the 9:16 version beside it. The source register and capture manifest bind them to Trumpet Trainer `c19989a3b156ce97326e35b335e169014ca076f3`. These are local review artifacts, not deployment proof.
