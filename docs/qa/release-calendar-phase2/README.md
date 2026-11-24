# Release Calendar Phase 2 QA

The MP4s and screenshots were captured from the production build of commit `c74767e68751fb45a4dfc70aa17b4f8ff7ab4cab` at the exact localhost route in `results.json`. The browser intercepted admin reads with 90 synthetic persisted calendar rows and ten distinct immutable Agentified draft projections. No customer data or saved real session was used. The recorder rejected every write request and every request to an external origin.

The desktop (1280×800), constrained mid-width (820×900), and mobile (390×844) runs checked the real admin content-lane width; all five preparation states; long titles and campaign names; current source receipt display; filters and cleared filters; pagination and counts; keyboard focus; and truthful Details, recovery, and review destinations. `results.json` records the measured lane widths and explicitly false external side effects. The videos are H.264 MP4s and passed `ffprobe` metadata validation.

To regenerate, start the committed production build with `npm run start -- -p 3000`, then run `node scripts/qa/record-release-calendar-automation.mjs`. The local `.env.local` supplies public Supabase client configuration for a synthetic browser session. This is a read-only fixture walkthrough, not a live customer-data smoke.
