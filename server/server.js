/* ═══════════════════════════════════════════════════════════════
   INFINITE VYBEFLIX — FORTPESA DONATION BACKEND
   Zero-dependency Node.js server (Node 18+, built-in fetch).

   Endpoints
   ─────────
   GET  /api/health                    → uptime / config check
   POST /api/donate                    → validates + triggers FortPesa STK push
   GET  /api/donate/status/:uuid       → live status (proxied from FortPesa)
   POST /api/webhooks/fortpesa         → signed webhook receiver (HMAC-SHA256)

   Secrets live ONLY in environment variables — never in git, never
   in the frontend. See .env.example.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ── CONFIG (env) ─────────────────────────────────────────────── */
const PORT = parseInt(process.env.PORT || '8787', 10);

const FORTPESA_API_KEY = process.env.FORTPESA_API_KEY || '';        // pb_live_...
const FORTPESA_CHANNEL_ID = parseInt(process.env.FORTPESA_CHANNEL_ID || '', 10);
const FORTPESA_WEBHOOK_SECRET = process.env.FORTPESA_WEBHOOK_SECRET || ''; // whsec_...

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';           // e.g. https://infinitevybeflix.abrdns.com
const DATA_FILE = process.env.DATA_FILE || '';                      // optional JSON persistence
const MAX_AMOUNT = parseInt(process.env.MAX_AMOUNT || '1000000', 10);
const MIN_AMOUNT = parseInt(process.env.MIN_AMOUNT || '1', 10);

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '8', 10);          // STK pushes ...
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '600000', 10); // ... per 10 min / IP

const FORTPESA_BASE = (process.env.FORTPESA_BASE_URL || 'https://fortpesa.co.ke/api/v1').replace(/\/+$/, '');

/* ── VALIDATION ───────────────────────────────────────────────── */
if (!FORTPESA_API_KEY) console.warn('[warn] FORTPESA_API_KEY is not set — STK pushes will fail.');
if (!Number.isInteger(FORTPESA_CHANNEL_ID)) console.warn('[warn] FORTPESA_CHANNEL_ID is not set — STK pushes will fail.');
if (!FORTPESA_WEBHOOK_SECRET) console.warn('[warn] FORTPESA_WEBHOOK_SECRET is not set — webhook will reject every event.');

/* ── STORE (in-memory + optional JSON file) ───────────────────── */
const transactions = new Map(); // uuid → { uuid, status, amount, phone, reference, provider_transaction_id, created_at, updated_at }

if (DATA_FILE) {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      for (const t of Array.isArray(raw) ? raw : []) transactions.set(t.uuid, t);
      console.log(`[store] loaded ${transactions.size} transaction(s) from ${DATA_FILE}`);
    }
  } catch (e) {
    console.warn('[store] could not load data file:', e.message);
  }
}

let flushTimer = null;
function persist() {
  if (!DATA_FILE) return;
  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify([...transactions.values()], null, 2));
    } catch (e) {
      console.warn('[store] could not write data file:', e.message);
    }
  }, 250);
}

/* ── HELPERS ──────────────────────────────────────────────────── */
function json(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...corsHeaders(),
    ...extraHeaders
  });
  res.end(data);
}

function corsHeaders() {
  const origin = ALLOWED_ORIGIN === '*' ? '*' : ALLOWED_ORIGIN.split(',').map(s => s.trim()).filter(Boolean);
  return {
    'Access-Control-Allow-Origin': origin === '*' ? '*' : origin[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/** Normalize a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX. Returns null if invalid. */
function normalizeKenyanPhone(input) {
  let d = String(input || '').replace(/\D+/g, '');
  if (d.startsWith('0')) d = '254' + d.slice(1);
  else if ((d.startsWith('7') || d.startsWith('1')) && d.length === 9) d = '254' + d;
  if (!/^254(7\d{8}|1\d{8})$/.test(d)) return null;
  return d;
}

/** Map a raw FortPesa status to pending | success | failed */
function mapStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'pending' || s === 'processing' || s === 'sent' || s === '') return 'pending';
  return 'failed'; // failed, cancelled, expired, anything unknown
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ── RATE LIMIT (per IP, in-memory) ───────────────────────────── */
const hits = new Map(); // ip → [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (arr.length >= RATE_LIMIT_MAX) { hits.set(ip, arr); return true; }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

/* ── FORTPESA CLIENT ──────────────────────────────────────────── */
async function fortPesaStkPush({ amount, phone }) {
  const idempotencyKey = 'don-' + crypto.randomUUID().replace(/-/g, ''); // 8-128 chars of [A-Za-z0-9._:-]
  const res = await fetch(`${FORTPESA_BASE}/payments/stk`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FORTPESA_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify({
      amount,                    // whole KES integer
      phone,                     // 2547XXXXXXXX
      channel_id: FORTPESA_CHANNEL_ID,
      account_reference: 'VYBEDONATE',   // ≤ 12 chars
      description: 'Vybe donation'       // ≤ 13 chars
    })
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function fortPesaGetTransaction(uuid) {
  const res = await fetch(`${FORTPESA_BASE}/transactions/${encodeURIComponent(uuid)}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${FORTPESA_API_KEY}` }
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/** Webhook signature: HMAC-SHA256("{timestamp}.{raw_body}", secret), hex, header X-Fortpesa-Signature */
function verifyWebhookSignature(rawBody, timestamp, signature) {
  if (!FORTPESA_WEBHOOK_SECRET) return false;
  if (!timestamp || !signature) return false;

  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false; // reject stale/replayed

  const expected = crypto.createHmac('sha256', FORTPESA_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  const got = String(signature).replace(/^sha256=/, '').trim().toLowerCase();
  const exp = expected.toLowerCase();
  if (got.length !== exp.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(exp)); // constant-time
}

function upsertFromFortPesa(data, fallbackPhone = '') {
  if (!data || !data.uuid) return null;
  const prev = transactions.get(data.uuid) || {};
  const rec = {
    uuid: data.uuid,
    status: mapStatus(data.status || prev.status),
    raw_status: data.status || prev.raw_status || '',
    amount: data.amount ?? prev.amount ?? null,
    phone: prev.phone || fallbackPhone,
    reference: data.account_reference || prev.reference || 'VYBEDONATE',
    provider_transaction_id: data.provider_transaction_id || prev.provider_transaction_id || null,
    platform_fee: data.platform_fee ?? prev.platform_fee ?? null,
    created_at: prev.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  transactions.set(data.uuid, rec);
  persist();
  return rec;
}

/* ── ROUTES ───────────────────────────────────────────────────── */
async function handleDonate(req, res, ip) {
  if (!FORTPESA_API_KEY || !Number.isInteger(FORTPESA_CHANNEL_ID)) {
    return json(res, 503, { error: { code: 'NOT_CONFIGURED', message: 'Donations are not configured yet. Please try again later.' } });
  }
  if (rateLimited(ip)) {
    return json(res, 429, { error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a few minutes.' } });
  }

  let parsed;
  try {
    parsed = JSON.parse((await readBody(req, 2048)).toString('utf8') || '{}');
  } catch {
    return json(res, 400, { error: { code: 'BAD_JSON', message: 'Invalid request body.' } });
  }

  const amount = Number(parsed.amount);
  if (!Number.isInteger(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return json(res, 422, { error: { code: 'INVALID_AMOUNT', message: `Enter a whole amount between KES ${MIN_AMOUNT} and KES ${MAX_AMOUNT}.` } });
  }

  const phone = normalizeKenyanPhone(parsed.phone);
  if (!phone) {
    return json(res, 422, { error: { code: 'INVALID_PHONE', message: 'Enter a valid Safaricom/Kenyan number, e.g. 0712 345 678.' } });
  }

  let fp;
  try {
    fp = await fortPesaStkPush({ amount, phone });
  } catch (e) {
    console.error('[donate] network error talking to FortPesa:', e.message);
    return json(res, 502, { error: { code: 'UPSTREAM_DOWN', message: 'Payment service unreachable. Please try again.' } });
  }

  if (!fp.ok) {
    const code = fp.body?.error?.code || 'UNKNOWN';
    const message = {
      UNAUTHENTICATED: 'Payment provider rejected the API key. Check FORTPESA_API_KEY.',
      INSUFFICIENT_BALANCE: 'Donation wallet needs a top-up. Please try again later.',
      VALIDATION_ERROR: fp.body?.error?.message || 'The payment details were rejected.',
      RATE_LIMITED: 'Too many requests right now. Please try again shortly.',
      CHANNEL_NOT_APPROVED: 'The donation channel is not approved yet.'
    }[code] || fp.body?.error?.message || 'Could not start the payment. Please try again.';

    console.error(`[donate] FortPesa ${fp.status} ${code} for ${phone} amount=${amount}`);
    return json(res, fp.status === 402 || fp.status === 503 ? 502 : fp.status, { error: { code, message } });
  }

  const data = fp.body?.data || {};
  const rec = upsertFromFortPesa({ ...data, status: data.status || 'pending' }, phone);
  return json(res, 200, {
    uuid: rec.uuid,
    status: rec.status,
    amount: rec.amount,
    phone: rec.phone
  });
}

async function handleStatus(req, res, uuid) {
  if (!uuid || !/^[0-9a-fA-F-]{8,64}$/.test(uuid)) {
    return json(res, 400, { error: { code: 'BAD_UUID', message: 'Invalid transaction id.' } });
  }

  // Trust only the GET from FortPesa (non-terminal rows are live-reconfirmed there).
  let fp;
  try {
    fp = await fortPesaGetTransaction(uuid);
  } catch (e) {
    console.error('[status] network error:', e.message);
    return json(res, 502, { error: { code: 'UPSTREAM_DOWN', message: 'Status service unreachable. Please try again.' } });
  }

  if (!fp.ok) {
    if (fp.status === 404) return json(res, 404, { error: { code: 'TRANSACTION_NOT_FOUND', message: 'Transaction not found.' } });
    return json(res, 502, { error: { code: 'UPSTREAM_ERROR', message: 'Could not fetch transaction status.' } });
  }

  const rec = upsertFromFortPesa(fp.body?.data || { uuid, status: 'pending' });
  return json(res, 200, {
    uuid: rec.uuid,
    status: rec.status,          // pending | success | failed
    raw_status: rec.raw_status,  // success | failed | cancelled | expired | pending ...
    amount: rec.amount,
    provider_transaction_id: rec.provider_transaction_id
  });
}

async function handleWebhook(req, res) {
  let raw;
  try { raw = await readBody(req, 65536); }
  catch { return json(res, 413, { error: { code: 'BODY_TOO_LARGE', message: 'Payload too large.' } }); }

  const signature = req.headers['x-fortpesa-signature'];
  const timestamp = req.headers['x-fortpesa-timestamp'];

  if (!verifyWebhookSignature(raw, timestamp, signature)) {
    console.warn('[webhook] rejected: bad/missing signature or stale timestamp');
    return json(res, 401, { error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } });
  }

  let event;
  try { event = JSON.parse(raw.toString('utf8')); }
  catch { return json(res, 400, { error: { code: 'BAD_JSON', message: 'Invalid JSON.' } }); }

  const data = event?.data || {};
  // Never trust the webhook body alone — re-fetch the transaction and store only that.
  try {
    const fp = await fortPesaGetTransaction(data.uuid);
    if (fp.ok) {
      const rec = upsertFromFortPesa(fp.body?.data || data);
      console.log(`[webhook] ${event.event || 'transaction.updated'} → uuid=${rec?.uuid} status=${rec?.status}`);
    } else {
      console.warn(`[webhook] re-fetch failed (${fp.status}) for uuid=${data.uuid}`);
    }
  } catch (e) {
    console.error('[webhook] re-fetch network error:', e.message);
  }

  return json(res, 200, { received: true });
}

/* ── HTTP SERVER ──────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = `${req.method} ${url.pathname}`;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  try {
    if (route === 'GET /api/health') {
      return json(res, 200, {
        ok: true,
        fortpesa_configured: Boolean(FORTPESA_API_KEY && Number.isInteger(FORTPESA_CHANNEL_ID)),
        webhook_configured: Boolean(FORTPESA_WEBHOOK_SECRET),
        transactions_known: transactions.size,
        uptime_s: Math.round(process.uptime())
      });
    }

    if (route === 'POST /api/donate') return await handleDonate(req, res, ip);

    const statusMatch = url.pathname.match(/^\/api\/donate\/status\/([^/]+)$/);
    if (req.method === 'GET' && statusMatch) return await handleStatus(req, res, decodeURIComponent(statusMatch[1]));

    if (route === 'POST /api/webhooks/fortpesa') return await handleWebhook(req, res);

    return json(res, 404, { error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' } });
  } catch (e) {
    console.error('[server] unhandled error:', e);
    if (!res.headersSent) return json(res, 500, { error: { code: 'INTERNAL', message: 'Internal server error.' } });
  }
});

server.listen(PORT, () => {
  console.log(`[fortpesa-backend] listening on :${PORT}`);
  console.log(`  STK endpoint     : ${FORTPESA_BASE}/payments/stk`);
  console.log(`  Channel ID       : ${Number.isInteger(FORTPESA_CHANNEL_ID) ? FORTPESA_CHANNEL_ID : '(missing!)'}`);
  console.log(`  Webhook secret   : ${FORTPESA_WEBHOOK_SECRET ? 'set' : '(missing!)'}`);
  console.log(`  Allowed origin   : ${ALLOWED_ORIGIN}`);
});
