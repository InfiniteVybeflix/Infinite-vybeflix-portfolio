# Infinite Vybeflix — FortPesa Donation Backend

Zero-dependency Node.js server (Node 18+, no `npm install` needed) that keeps
your FortPesa API key off the frontend and talks to FortPesa on behalf of your
GitHub Pages site.

## Endpoints

| Method | Path                        | Purpose                                             |
|--------|-----------------------------|-----------------------------------------------------|
| GET    | `/api/health`               | Config check (used after deploy)                    |
| POST   | `/api/donate`               | Validate amount + phone, trigger M-Pesa STK push    |
| GET    | `/api/donate/status/:uuid`  | Live transaction status (proxied from FortPesa)     |
| POST   | `/api/webhooks/fortpesa`    | Signed webhook receiver (HMAC-SHA256 verified)      |

## Run locally

```bash
cp .env.example .env            # fill in real values
set -a; source .env; set +a     # export the variables
node server.js                  # → http://localhost:8787/api/health
```

## Deploy (Render free tier — recommended)

1. Push this repo to GitHub (the `server/` folder comes with it).
2. Render dashboard → **New → Web Service** → connect the repo.
   - **Root Directory:** `server`
   - **Build Command:** `npm install` (instant — there are no dependencies)
   - **Start Command:** `npm start`
   - **Instance type:** Free
3. Under **Environment**, add:
   - `FORTPESA_API_KEY` = your `pb_live_...` key
   - `FORTPESA_CHANNEL_ID` = your donation channel ID (integer)
   - `FORTPESA_WEBHOOK_SECRET` = your `whsec_...` secret
   - `ALLOWED_ORIGIN` = `https://infinitevybeflix.abrdns.com`
   - optional `DATA_FILE` = `/tmp/donations.json` or a mounted disk path
4. Deploy → verify `https://<your-service>.onrender.com/api/health` returns
   `{"ok":true,"fortpesa_configured":true,...}`.
5. In the FortPesa dashboard, register the webhook URL:
   `https://<your-service>.onrender.com/api/webhooks/fortpesa`

> Where do secrets go? GitHub Pages needs **no** secrets (nothing sensitive
> ships in the static site). The backend reads its secrets from the host's
> environment (Render env vars). GitHub Secrets are only relevant if you
> later deploy the backend through a GitHub Actions workflow — the same
> three values would then live there as repository secrets.

## Security behaviour

- API key and webhook secret are read from environment variables only.
- Webhook: rejects missing/invalid `X-Fortpesa-Signature`, timestamps older
  than 300 s (replay protection), verifies with a constant-time compare, then
  **re-fetches the transaction via GET and stores only that result**.
- Per-IP rate limiting on STK pushes (default 8 per 10 min) so nobody can
  spam prompts or drain your FortPesa fee wallet.
- CORS is restricted to `ALLOWED_ORIGIN`.
- Amounts are whole KES integers; phones are normalized to `2547XXXXXXXX`.
- `account_reference: VYBEDONATE`, `description: Vybe donation` (within the
  12/13-char FortPesa limits).
