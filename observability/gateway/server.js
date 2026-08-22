'use strict';

/**
 * Telemetry ingest gateway for the JISST app.
 *
 * Routes:
 *   POST /web    -> anonymous browser beacons. CORS-protected, no auth.
 *                   PII fields (email/user) are stripped before storage.
 *   POST /server -> backend audit events. Requires `Authorization: Bearer <INGEST_TOKEN>`.
 *                   Email is allowed here (server-side audit trail only).
 *   GET  /health -> liveness probe.
 *
 * Everything is forwarded to Loki's push API. The gateway is intentionally
 * fire-and-forget friendly: clients should never block on it, and any Loki
 * outage is contained here (we just return 202 and log the error).
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '8888', 10);
const LOKI_URL = process.env.LOKI_URL || 'http://loki:3100';
const INGEST_TOKEN = process.env.INGEST_TOKEN || '';
const ENV = process.env.NODE_ENV || 'production';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_BODY_BYTES = 64 * 1024; // 64 KB per request
const MAX_EVENTS = 50; // per batch
const LABEL_RE = /^[a-zA-Z0-9_]{1,40}$/;

function sanitizeLabelValue(v, fallback) {
  if (typeof v !== 'string') return fallback;
  return LABEL_RE.test(v) ? v : fallback;
}

function pushToLoki(streams) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ streams });
    let u;
    try {
      u = new URL('/loki/api/v1/push', LOKI_URL);
    } catch (e) {
      return reject(e);
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      u,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 4000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          if (res.statusCode && res.statusCode < 300) resolve();
          else reject(new Error('loki ' + res.statusCode + ' ' + d.slice(0, 200)));
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('loki timeout')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Turn an array of event objects into Loki streams.
 * Labels are kept low-cardinality: { app, source, type, env }.
 * Everything else goes into the JSON log line.
 */
function buildStreams(events, source) {
  const app = source === 'browser' ? 'jisst-frontend' : 'jisst-backend';
  const groups = new Map();

  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;

    const type = sanitizeLabelValue(ev.type, 'event');
    const line = { ...ev };

    // Enforce anonymity on the public browser path.
    if (source === 'browser') {
      delete line.email;
      delete line.user;
      delete line.userEmail;
    }

    // Use server receive time for the Loki timestamp (avoids clock skew / ordering issues).
    const tsNs = (Date.now() * 1e6).toString();
    const key = type;
    if (!groups.has(key)) {
      groups.set(key, {
        stream: { app, source, type, env: ENV },
        values: [],
      });
    }
    groups.get(key).values.push([tsNs, JSON.stringify(line)]);
  }

  return Array.from(groups.values()).filter((s) => s.values.length > 0);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function corsHeaders(origin) {
  const headers = {
    Vary: 'Origin',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function send(res, status, headers, body) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json' }, headers || {}));
  res.end(body || '');
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    return send(res, 204, corsHeaders(origin), '');
  }

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, {}, JSON.stringify({ ok: true }));
  }

  if (req.method !== 'POST') {
    return send(res, 405, {}, JSON.stringify({ error: 'method not allowed' }));
  }

  const isWeb = req.url === '/web';
  const isServer = req.url === '/server';
  if (!isWeb && !isServer) {
    return send(res, 404, {}, JSON.stringify({ error: 'not found' }));
  }

  // Auth: browser path is CORS-gated; server path requires a bearer token.
  if (isServer) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!INGEST_TOKEN || token !== INGEST_TOKEN) {
      return send(res, 401, {}, JSON.stringify({ error: 'unauthorized' }));
    }
  }

  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    return send(res, 413, corsHeaders(origin), JSON.stringify({ error: String(e.message || e) }));
  }

  let parsed;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch (e) {
    return send(res, 400, corsHeaders(origin), JSON.stringify({ error: 'invalid json' }));
  }

  let events = Array.isArray(parsed) ? parsed : parsed && parsed.events ? parsed.events : [parsed];
  events = (events || []).filter(Boolean).slice(0, MAX_EVENTS);
  if (events.length === 0) {
    return send(res, 400, corsHeaders(origin), JSON.stringify({ error: 'no events' }));
  }

  const streams = buildStreams(events, isWeb ? 'browser' : 'server');

  // Respond immediately; ship to Loki in the background so callers never wait.
  send(res, 202, corsHeaders(origin), JSON.stringify({ accepted: events.length }));

  if (streams.length > 0) {
    pushToLoki(streams).catch((err) => {
      console.error('[gateway] loki push failed:', err.message);
    });
  }
});

server.listen(PORT, () => {
  console.log(`[gateway] listening on :${PORT} -> ${LOKI_URL} (env=${ENV})`);
  console.log(`[gateway] allowed origins: ${ALLOWED_ORIGINS.join(', ') || '(none)'}`);
});
