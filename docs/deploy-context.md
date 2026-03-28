# Deploy context (AmaduTown portfolio)

Reference for **where production configuration lives** and how it ties to the codebase. This file intentionally contains **no secrets** — do not commit API keys, service role keys, or full webhook URLs that include authentication tokens.

## Hosting and environment variables

| Scope | Where values live |
|--------|-------------------|
| **Production / Preview** | Hosting dashboard → project → **Environment Variables** (commonly **Vercel**: Project → Settings → Environment Variables). Values are never in git. |
| **Local development** | `.env.local` (gitignored). Copy from `.env.example`. |

Agents cannot read the hosting dashboard. For questions like “what is the production value of X?”: use the **variable name** here and in `.env.example`, then the human checks the dashboard — or derive the **default** from code (see below).

## Stack (deploy-facing)

- **App:** Next.js 14 (App Router), TypeScript — server routes under `app/api/**`.
- **Database / auth:** Supabase (URL + anon key public; service role server-only).
- **Automation:** n8n; default instance base in code is `https://amadutown.app.n8n.cloud` when `N8N_BASE_URL` is unset (`lib/n8n.ts`).

## Canonical code references

- **`lib/n8n.ts`** — `N8N_BASE_URL`, `n8nWebhookUrl('path-segment')`, per-feature webhook helpers.
- **`lib/n8n-runtime-flags.ts`** — `MOCK_N8N`, `N8N_DISABLE_OUTBOUND` (staging/production defaults vs local overrides: see `.env.example` and `docs/staging-environment.md`).
- **`.env.example`** — exhaustive list of `N8N_*` and other vars with inline comments.

## n8n webhook URL rules

1. **Production URL only** for server-side `fetch`: path must be `.../webhook/...` from the Webhook node’s **Production** URL in n8n.
2. **Do not** use `.../webhook-test/...` for production app calls — that listener is for the editor; server calls often get **404**.
3. **Overrides:** Many features use `process.env.N8N_*_WEBHOOK_URL` **or** `n8nWebhookUrl('literal-segment')`. If the override is unset, the app builds `{N8N_BASE_URL}/webhook/{segment}`.

### Social content admin → n8n (common segments)

| Purpose | Env override (optional) | Default path segment |
|--------|-------------------------|----------------------|
| Extract pipeline | `N8N_SOC001_WEBHOOK_URL` | `social-content-extract` |
| Publish | `N8N_SOC002_WEBHOOK_URL` | `social-content-publish` |
| Regenerate image | `N8N_SOC_REGENERATE_IMAGE_WEBHOOK_URL` | `social-content-regenerate-image` |
| Regenerate audio / voiceover | `N8N_SOC_REGENERATE_AUDIO_WEBHOOK_URL` | `social-content-regenerate-audio` |

Implementation: `app/api/admin/social-content/[id]/regenerate-audio/route.ts` (and siblings) post JSON to that URL. **The n8n workflow attached to that webhook must expect that payload** (e.g. `content_id`, `voiceover_text`) and operate on **`social_content_queue`**, not an unrelated table such as `contact_submissions`. Pointing an override at the wrong workflow (e.g. a “qualified lead” flow) produces confusing n8n errors and failed admin actions.

## How to trace “effective” URL without the dashboard

1. Grep the repo for `process.env.N8N_…` in the route or `lib/n8n.ts`.
2. If an override env is **set** on the server, that full URL wins (check dashboard for the value).
3. If unset, effective URL is `${N8N_BASE_URL}/webhook/${segment}` with defaults as in `lib/n8n.ts`.

## Related documentation

- `docs/staging-environment.md` — `NEXT_PUBLIC_APP_ENV`, n8n mock/outbound behavior by tier.
- `docs/staging-vercel-n8n-sync.md` — keeping Vercel and n8n aligned for staging.
- `docs/staging-n8n-activation-matrix.md` — which workflows matter per environment.
