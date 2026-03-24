# Staging publications parity (homepage cards + Listen)

Goal: the **Publications** section on the staging site matches production — two cards (The Equity Code, Accelerated), **Listen** players using preview MP3s from **this** Supabase project’s public `lead-magnets` bucket, and Accelerated linked to ebook slug `accelerated`.

## 1. Storage (required)

In the **staging** Supabase project → **Storage** → bucket **`lead-magnets`** (public), ensure these objects exist (same paths as prod):

| Object key | Purpose |
|------------|---------|
| `equity_code_audio_leadmagnet.mp3` | Equity Code in-card player |
| `accelerated_audio_leadmagnet.mp3` | Accelerated in-card player |
| `accelerated_ebook_leadmagnet.epub` | Gated ebook download (via lead magnet row) |

Copy from production (Dashboard download + upload) or use [Supabase CLI storage copy](https://supabase.com/docs/guides/cli) between projects if you prefer.

## 2. Database sync

From the repo root, with `.env.staging` containing **staging** `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`:

```bash
npm run staging:publications-parity
```

This runs `scripts/ensure-publications-experience-parity.ts`, which:

- Upserts the **Accelerated** ebook row on `lead_magnets` (`slug = accelerated`) and aligns fields with prod/seed.
- Upserts **publications** rows by title: copy, `display_order`, `is_published`, `lead_magnet_id`, and `audio_preview_url` built as  
  `{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lead-magnets/{file}.mp3`.

Optional: seed the full planned lead magnet list on staging (not required for these two cards if you only run the parity script):

```bash
npx tsx scripts/seed-lead-magnets.ts --env-file .env.staging
```

## 3. Deploy / env

Vercel **staging** must use the same staging Supabase URL/keys as `.env.staging` so `/api/publications` resolves the same rows and URLs.

## 4. Smoke check

Open the staging homepage → **Publications**: both cards, covers from `/public`, **Listen** shows duration and plays (large files may buffer slowly).

If the player shows **0:00** or errors, confirm each file opens in the browser:

`{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/lead-magnets/equity_code_audio_leadmagnet.mp3`  
(and the Accelerated filenames above). **HTTP 400** from Storage usually means the object is missing or the bucket/path is wrong — upload or fix policies before retesting.
