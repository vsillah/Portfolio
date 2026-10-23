# Public chat stale-route recovery review

This packet shows the public chat on the local homepage at 1440 × 900 and 390 × 844. The question is: “What chatbot services does AmaduTown offer?” The browser receives a fixture response from the real `sendToN8n` fallback after a mocked HTTP 530 / Cloudflare 1033. No hosted webhook, Supabase database, or provider was called.

The fallback names the two active public catalog offers, describes their listed purpose, links to their service details, and points to the existing contact and discovery-call paths. It marks the interruption, preserves the escalation state, and leaves “Try again” available. The fixture returns a successful chat response on retry so the walkthrough can show that action completing.

## Evidence

- `desktop-fallback-top.png` and `desktop-fallback-bottom.png`: the offer answer, links, and retry control in the 1440px UI.
- `mobile-fallback-top.png` and `mobile-fallback-bottom.png`: the same answer in the phone UI; the transcript scrolls inside the chat panel.
- `desktop-retry.png` and `mobile-retry.png`: the response after using “Try again.”
- `mobile-walkthrough.mp4`: continuous, cropped screen recording of the phone interaction.
- `desktop-walkthrough.mp4`: three captured desktop panel states in sequence. Chromium's desktop recording on this host scaled the 1440px viewport into a small corner, so this MP4 uses the readable screenshots. It is a captured-state walkthrough, not a continuous desktop recording.

Both MP4s were decoded with FFprobe: H.264, 590 × 524 at 7.56 seconds for desktop and 370 × 500 at 7.40 seconds for mobile. The reviewed route was `http://127.0.0.1:5317/#contact`, with fixture-only API responses and browser requests restricted to that local origin.

## Reproduce

Start the local app with disposable values in a separate terminal:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:59999 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-anon-key \
SUPABASE_SERVICE_ROLE_KEY=fixture-service-key \
N8N_DISABLE_OUTBOUND=true \
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:5317 \
./node_modules/.bin/next dev --hostname 127.0.0.1 --port 5317
```

Then run `./node_modules/.bin/tsx scripts/qa/chatbot-stale-route-review.ts`. The script intercepts the chat API, aborts non-local browser requests, checks both service links and retry behavior, captures screenshots, and creates the MP4s with FFmpeg. It uses no real customer data.

This is local fixture QA. The production configuration repair and a live end-to-end chatbot reply remain separate captain gates.
