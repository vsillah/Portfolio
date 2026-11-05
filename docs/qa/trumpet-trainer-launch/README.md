# Trumpet Trainer Portfolio launch review

Route: `/work/trumpet-trainer?qa=portfolio-launch` on local port 3217 from `codex/trumpet-trainer-portfolio-launch`.

The local review used inert Supabase placeholders with outbound n8n disabled. No production data was queried or changed. `node scripts/qa/trumpet-trainer-launch.mjs` checked HTTP 200, page heading, horizontal overflow, hero CTA, form validation, blocked child-identifier example, email-draft state, the back link, and the Work card at 360, 768, and 1280 px. The email-draft link was inspected, not opened or sent.

Screenshots: `route-360.png`, `route-768.png`, `route-1280.png`.

Walkthroughs: `walkthrough-360.mp4`, `walkthrough-1280.mp4`. Both use synthetic adult test data and show the form's blocked and ready states. These MP4s are review evidence for the branch, not proof of a deployed intake.
