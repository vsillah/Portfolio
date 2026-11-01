# Dark Castle copy-review route reconciliation

Reviewed product code: `5902071c66c34b11de221b7c13a592c240f9759b` on `codex/dark-castle-copy-review-route-reconciliation`.

Exact localhost route: `http://localhost:5328/admin/social-content/c12378f2-36de-4bf7-8c5d-0ce754e727eb?step=copy&review=mobile&proposal=52489ae5-27c7-4c05-94ac-d7f907bd88a6&rev=5902071c#social-mobile-decision-receipt`

The local server used the production project's public Supabase configuration and server API key for read-only inspection. Outbound n8n was disabled. No decision or external action was invoked. The temporary environment export was removed after server startup.

## Evidence

- `desktop-panel-5902071c.jpg`: 1440 × 900, exact protected packet with all six ready receipts and pending Copy review.
- `mobile-top-5902071c.jpg`: 390 × 844, protected packet entry and Decision Queue link.
- `mobile-controls-5902071c.jpg`: 390 × 844, wrapped receipt IDs, read-only projection, and untouched decision controls.
- `walkthrough-5902071c.mp4`: 10-second H.264 walkthrough assembled from the three captured browser screenshots. It shows desktop and paired mobile views; it is not a continuous screen recording.

At 390 pixels, both the main content and protected panel reported matching client and scroll widths (380 and 346 pixels respectively), with no horizontal overflow. The legacy channel-experiment early-return view did not own the selected proposal route. The six receipt statuses were ready; the approval remained pending. Provider, upload, platform-draft, scheduling, publishing, cross-post, credential, and external-send gates were not exercised.
