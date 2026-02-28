# Printful Webhook Setup

The app receives `package_shipped` events from Printful at `POST /api/webhooks/printful` and updates order tracking. The webhook URL must be registered with Printful via their Webhook API.

## One-time registration

1. **Token scope**  
   Ensure your Printful Private Token has **webhooks** (Read and Write) enabled. If not, create a new token in [Printful Developer Portal](https://developers.printful.com/) → Your tokens and set `PRINTFUL_API_KEY` in `.env.local` / Vercel.

2. **Production URL**  
   For production, set `NEXT_PUBLIC_SITE_URL` (e.g. `https://amadutown.com`) so the script registers the production webhook URL. Otherwise the script uses `VERCEL_URL` or `http://localhost:3000`.

3. **Run the setup script once**  
   ```bash
   npm run printful:webhook
   ```  
   This registers `{origin}/api/webhooks/printful` with event type `package_shipped`.

## Optional: Admin API

- **GET** `/api/admin/printful/webhook` — returns current webhook config (admin auth required).
- **POST** `/api/admin/printful/webhook` — sets webhook URL (optional body `{ "url": "..." }`; defaults to env-based URL). Admin auth required.

## Verification

- After running the script, call Printful **GET /webhooks** (or use the admin GET route) and confirm `url` is `https://<your-domain>/api/webhooks/printful` and `types` includes `package_shipped`.
- Use [Printful Webhook Simulator](https://developers.printful.com/docs/#tag/Other-resources/Webhook-Simulator) to send a test `package_shipped` to your URL and confirm the handler returns 200 and updates the order when `printful_order_id` matches.
