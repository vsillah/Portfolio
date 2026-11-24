# Release Calendar preparation view QA

The videos and screenshots show the production build at the commit and route recorded in `results.json`. The browser test intercepts admin reads with synthetic rows, including five preparation states and ten distinct Agentified draft projections. It rejects all write requests and checks for horizontal overflow at 1280×800, 820×900, and 390×844.

Run `node scripts/qa/record-release-calendar-automation.mjs` against `next start -p 3000` to regenerate. The local `.env.local` supplies public Supabase client configuration; the script creates a synthetic session and does not use a saved real account token. The MP4 files are H.264 and were checked with `ffprobe`.
