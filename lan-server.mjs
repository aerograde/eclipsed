#!/usr/bin/env node
/*
 * eclipsed. — LAN room directory + app host
 * ------------------------------------------
 * The app itself (index.svg) is a single self-contained file. This tiny server
 * is only how you run it: it serves index.svg to your devices AND resolves the
 * short room codes between them on your network.
 *
 *   node lan-server.mjs          # then open http://<this-machine-IP>:8377/
 *
 * How a join works (all invisible to the user):
 *   create #abc  -> host posts its WebRTC offer here under "abc"
 *   join #abc    -> guest fetches that offer, posts its answer
 *   host polls   -> applies the answer; the two browsers connect peer-to-peer
 *
 * LAN-only by design:
 *   - /lan/* endpoints answer only private / loopback / link-local sources,
 *     so nobody outside your network can create, claim, or join rooms. That is
 *     exactly what makes arbitrarily short custom codes safe.
 *   - A room is owned by the host that created it (owner token); only that host
 *     may refresh or delete it. Rooms expire after 10 min without a heartbeat.
 *   - Nothing is ever written to disk.
 */

import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';

const PROJECT_ROOT = process.cwd();

function arg(name, fallback) {
  const at = process.argv.indexOf('--' + name);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}
const PORT = Number(arg('port', process.env.PORT || '8377')) || 8377;
const HOST = arg('host', process.env.HOST || '0.0.0.0');
const STATIC_ROOT = path.resolve(arg('dir', process.env.DIR || PROJECT_ROOT));

const ROOM_TTL_MS = 3 * 60 * 1000;
const ADMIN_MONO_COLOR = '#c9c9c9';
const ADMIN_CODE_VALUE = String(process.env.ECLIPSED_ADMIN_CODE || process.env.ADMIN_NAME_SECRET || '').trim();
const ADMIN_NAME_SUFFIX = ADMIN_CODE_VALUE ? (ADMIN_CODE_VALUE.charAt(0) === '#' ? ADMIN_CODE_VALUE : '#' + ADMIN_CODE_VALUE) : '';
let adminAuthorityKeys = null;
// A room whose owner has not refreshed it for this long is considered stale:
// its host is gone (heartbeats stop on close/crash), so another device may
// take the code over instead of waiting out the TTL.
const ROOM_STALE_MS = 90 * 1000;
const ANSWER_BATCH = 40;
const MAX_BODY_BYTES = 1024 * 1024;
const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ROOMS_PREFIX = '/lan/rooms/';

const MIME = {
  '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm'
};

// code -> { code, offer, owner, name, at, nextAnswerId, answers: [{id, at, raw}] }
const rooms = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now - room.at > ROOM_TTL_MS) rooms.delete(code);
}, 60 * 1000).unref();

function adminKeyMaterial() {
  if (adminAuthorityKeys) return adminAuthorityKeys;
  const signing = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const box = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
  adminAuthorityKeys = {
    publicKey: signing.publicKey,
    privateKey: signing.privateKey,
    publicJwk: signing.publicKey.export({ format: 'jwk' }),
    boxPublicKey: box.publicKey,
    boxPrivateKey: box.privateKey,
    boxPublicJwk: box.publicKey.export({ format: 'jwk' })
  };
  return adminAuthorityKeys;
}

function adminVisibleName(rawName) {
  const name = String(rawName || '').trim();
  if (!ADMIN_NAME_SUFFIX || !name.endsWith(ADMIN_NAME_SUFFIX)) return null;
  const visible = name.slice(0, -ADMIN_NAME_SUFFIX.length).trim().slice(0, 24);
  return visible || null;
}

function decryptAdminClaim(ciphertext) {
  const encoded = String(ciphertext || '').trim();
  if (!encoded || encoded.length > 8192) throw new Error('Invalid admin claim.');
  return JSON.parse(crypto.privateDecrypt({
    key: adminKeyMaterial().boxPrivateKey,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, b64uDecode(encoded)).toString('utf8'));
}

function signAdminGrant(userId) {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'ECLIPSED-ADMIN', alg: 'ES256' };
  const payload = {
    v: 1,
    sub: String(userId || '').trim().slice(0, 64),
    scope: 'admin',
    color: ADMIN_MONO_COLOR,
    iat: now,
    exp: now + 30 * 24 * 3600
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const signingInput = encode(header) + '.' + encode(payload);
  const signature = crypto.createSign('SHA256')
    .update(signingInput)
    .sign({ key: adminKeyMaterial().privateKey, dsaEncoding: 'ieee-p1363' });
  return signingInput + '.' + Buffer.from(signature).toString('base64url');
}

async function handleAdminApi(pathname, request, response) {
  if (!isPrivateSource(request.socket.remoteAddress || '')) {
    return sendJson(response, 403, { ok: false, error: 'LAN only.' });
  }
  if (pathname === '/api/admin/key' && request.method === 'GET') {
    const keys = adminKeyMaterial();
    return sendJson(response, 200, { ok: true, signing: keys.publicJwk, box: keys.boxPublicJwk });
  }
  if (!ADMIN_CODE_VALUE) {
    return sendJson(response, 503, { ok: false, error: 'Admin authority is not configured.' });
  }
  if (pathname === '/api/admin/claim' && request.method === 'POST') {
    return readBody(request).then((body) => {
      const claim = decryptAdminClaim(body.ciphertext);
      const userId = String(claim.userId || '').trim().slice(0, 64);
      const rawName = String(claim.name || '').trim().slice(0, 128);
      const name = adminVisibleName(rawName);
      if (!userId || !name) {
        return sendJson(response, 403, { ok: false, error: 'The admin code was not accepted.' });
      }
      return sendJson(response, 200, {
        ok: true,
        name,
        color: ADMIN_MONO_COLOR,
        grant: signAdminGrant(userId)
      });
    }).catch((error) => sendJson(response, 400, { ok: false, error: error.message }));
  }
  return sendJson(response, 404, { ok: false, error: 'Not found.' });
}

// ---------------------------------------------------------------------------
// LAN-only gate
// ---------------------------------------------------------------------------

function isPrivateSource(remote) {
  const raw = String(remote || '').replace(/^::ffff:/, '').toLowerCase();
  if (!raw || raw === '0.0.0.0') return true; // server-side req from listening socket
  if (raw === '127.0.0.1' || raw === '::1') return true;
  if (raw.includes(':')) {
    // link-local fe80::/10 or unique-local fc00::/7
    return /^fe[89ab]/.test(raw) || raw.startsWith('fc') || raw.startsWith('fd');
  }
  const parts = String(raw).split('.');
  if (parts.length !== 4) return false;
  const o = parts.map(Number);
  if (o.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return false;
  if (o[0] === 10) return true;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return true;
  if (o[0] === 192 && o[1] === 168) return true;
  if (o[0] === 169 && o[1] === 254) return true;
  return false;
}

function lanUrls() {
  const found = [];
  Object.values(os.networkInterfaces()).forEach((list) => (list || []).forEach((entry) => {
    if (entry.family === 'IPv4' && !entry.internal && isPrivateSource(entry.address)) found.push(entry.address);
  }));
  return (found.length ? found : ['127.0.0.1']).map((ip) => `http://${ip}:${PORT}/`);
}

// ---------------------------------------------------------------------------

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error('Payload too large.')); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(text ? JSON.parse(text) : {});
      } catch (error) { reject(new Error('Body is not valid JSON.')); }
    });
    request.on('error', reject);
  });
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*'
  });
  response.end(JSON.stringify(body));
}

function sendStatic(response, filePath) {
  stat(filePath)
    .then((info) => { if (!info.isFile()) throw new Error('missing'); return readFile(filePath); })
    .then((content) => {
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      response.end(content);
    })
    .catch(() => sendJson(response, 404, { ok: false, error: 'Not found.' }));
}

// ---------------------------------------------------------------------------
// Service worker — the worker lives inside index.svg (embedded block), so the
// app ships as one self-contained file with no separate sw.js. A worker script
// must be pure JavaScript, so when a browser fetches the app URL marked as a
// service-worker request (or one of the /sw.js · /sw.svg aliases) this server
// answers with just the embedded worker block as JavaScript; normal page
// fetches of the SVG keep the full document. The block itself also detects a
// window and stays inert when it is ever evaluated as part of the page.
// ---------------------------------------------------------------------------
const SW_BEGIN = '/*__ECLIPSED_SW_BEGIN__*/';
const SW_END = '/*__ECLIPSED_SW_END__*/';

function isServiceWorkerFetch(request) {
  const dest = String((request.headers && request.headers['sec-fetch-dest']) || '').toLowerCase();
  if (dest === 'serviceworker') return true;
  const swHeader = String((request.headers && request.headers['service-worker']) || '');
  return /script/i.test(swHeader);
}

function serveEmbeddedWorker(response) {
  readFile(path.join(STATIC_ROOT, 'index.svg'), 'utf8')
    .then((svg) => {
      const start = svg.indexOf(SW_BEGIN);
      const end = svg.indexOf(SW_END);
      if (start < 0 || end < 0 || end <= start) throw new Error('worker markers missing');
      const source = svg.slice(start + SW_BEGIN.length, end);
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      response.end(source);
    })
    .catch(() => sendJson(response, 404, { ok: false, error: 'Worker source missing.' }));
}

function handleApi(pathname, request, response, remote) {
  if (!isPrivateSource(remote)) {
    return sendJson(response, 403, { ok: false, error: 'LAN only.' });
  }

  if (pathname === '/lan/health' && request.method === 'GET') {
    return sendJson(response, 200, { ok: true, lan: true, rooms: rooms.size });
  }

  // GET /lan/rooms — every room currently open on this network (local
  // LocalSend-style discovery list; LAN clients only).
  if (pathname === '/lan/rooms' && request.method === 'GET') {
    const now = Date.now();
    const list = [];
    for (const room of rooms.values()) {
      if (now - room.at > ROOM_TTL_MS) { rooms.delete(room.code); continue; }
      list.push({ code: room.code, name: room.name || '', at: room.at });
    }
    list.sort((a, b) => b.at - a.at);
    return sendJson(response, 200, { ok: true, rooms: list });
  }

  if (pathname.indexOf(ROOMS_PREFIX) !== 0) {
    return sendJson(response, 404, { ok: false, error: 'Not found.' });
  }

  const parts = pathname.slice(ROOMS_PREFIX.length).split('/').filter(Boolean);
  const code = String(parts[0] || '').toLowerCase();
  if (!CODE_PATTERN.test(code)) return sendJson(response, 400, { ok: false, error: 'Invalid room code.' });
  const action = parts.slice(1).join('/');
  const entry = () => rooms.get(code);
  const json = (status, body) => sendJson(response, status, body);

  // PUT /lan/rooms/:code  {offer, owner} — create, or replace your own room
  if (request.method === 'PUT' && !action) {
    return readBody(request).then((body) => {
      const offer = String(body.offer || '').trim();
      if (!offer) return json(400, { ok: false, error: 'Missing offer.' });
      const owner = String(body.owner || '');
      if (!owner) return json(400, { ok: false, error: 'Missing owner.' });
      const existing = entry();
      if (existing && existing.owner !== owner) {
        // Dead-host squatting: if the current entry hasn't been refreshed in a
        // while its owner is gone, let the new host take the code over right
        // away instead of stalling joins for minutes.
        if (Date.now() - existing.at <= ROOM_STALE_MS) {
          return json(409, { ok: false, error: 'taken', message: 'That code already has a room on this network.' });
        }
      }
      const name = String(body.name || '').trim().slice(0, 24);
      rooms.set(code, { code, offer, owner, name, at: Date.now(), nextAnswerId: 1, answers: [] });
      return json(existing ? 200 : 201, { ok: true, code });
    }).catch((error) => json(400, { ok: false, error: error.message }));
  }

  // GET /lan/rooms/:code — fetch the host's offer so you can join
  if (request.method === 'GET' && !action) {
    const room = entry();
    if (!room) return json(404, { ok: false, error: 'No room is open with that code.' });
    room.at = Date.now();
    return json(200, { ok: true, code, offer: room.offer });
  }

  // POST /lan/rooms/:code/heartbeat {owner} — host keeps the room alive
  if (request.method === 'POST' && action === 'heartbeat') {
    return readBody(request).then((body) => {
      const room = entry();
      if (!room || room.owner !== String(body.owner || '')) return json(404, { ok: false, error: 'No room is open with that code.' });
      room.at = Date.now();
      return json(200, { ok: true, code });
    }).catch(() => json(400, { ok: false, error: 'Invalid request.' }));
  }

  // DELETE /lan/rooms/:code?owner=… — host leaves (or after connecting). The
  // owner token is required so a LAN client can never tear down a room it does
  // not host (rooms are owned by their creator; see the header comment).
  if (request.method === 'DELETE' && !action) {
    const owner = new URL(request.url, 'http://localhost').searchParams.get('owner') || '';
    const room = entry();
    if (!room) return json(404, { ok: false, error: 'No room is open with that code.' });
    if (!owner || room.owner !== owner) return json(409, { ok: false, error: 'Not your room.' });
    rooms.delete(code);
    return json(200, { ok: true, code });
  }

  // POST /lan/rooms/:code/answers {answer} — joiner posts its answer for the host
  if (request.method === 'POST' && action === 'answers') {
    return readBody(request).then((body) => {
      const room = entry();
      if (!room) return json(404, { ok: false, error: 'No room is open with that code.' });
      const answer = String(body.answer || '').trim();
      if (!answer) return json(400, { ok: false, error: 'Missing answer.' });
      room.answers.push({ id: room.nextAnswerId, at: Date.now(), raw: answer });
      room.nextAnswerId += 1;
      if (room.answers.length > ANSWER_BATCH) room.answers.splice(0, room.answers.length - ANSWER_BATCH);
      room.at = Date.now();
      return json(201, { ok: true, code, id: room.answers[room.answers.length - 1].id });
    }).catch((error) => json(400, { ok: false, error: error.message }));
  }

  // GET /lan/rooms/:code/answers?after=ID — host polls for new answers
  if (request.method === 'GET' && action === 'answers') {
    const room = entry();
    if (!room) return json(404, { ok: false, error: 'No room is open with that code.' });
    const after = Number(String(request.url.split('?')[1] || '').match(/after=(\d+)/)?.[1] || 0);
    room.at = Date.now();
    return json(200, { ok: true, code, after: room.nextAnswerId - 1, answers: room.answers.filter((a) => a.id > after) });
  }

  return json(404, { ok: false, error: 'Not found.' });
}


// ---------------------------------------------------------------------------
// Web Push hub (morphed from the rotation spec: the local Node server is the
// hub for peers that have connected through it). The browser cannot POST to a
// push service (CORS), so pushes are always sent by this server — meaning a
// peer gets notified even when its tab is closed, as long as its browser is
// awake and its subscription is registered here.
// ---------------------------------------------------------------------------

const PUSH_LIMITS = {
  perRecipient: 500,       // buffered placeholder quota (registry entries cap)
  maxCiphertext: 64 * 1024,
  sendsPerRecipientHour: 40,
  ttlSeconds: 7 * 24 * 3600
};

const pushSubs = new Map();   // peerId -> [{ endpoint, keys:{p256dh,auth}, at, sendsHour: [] }]
const VAPID_SUBJECT = 'mailto:eclipsed@lan';

let vapid = null;
function vapidKeys() {
  if (vapid) return vapid;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pubJwk = publicKey.export({ format: 'jwk' });
  const raw = rawPointFromJwk(pubJwk);
  vapid = {
    publicKey, privateKey,
    publicRaw: raw,
    publicB64: raw.toString('base64url')
  };
  return vapid;
}

function rawPointFromJwk(jwk) {
  return Buffer.concat([Buffer.from([4]), b64uDecode(jwk.x), b64uDecode(jwk.y)]);
}
const b64uEncode = (buf) => Buffer.from(buf).toString('base64url');
function b64uDecode(text) {
  let s = String(text || '').replace(/=+$/, '');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}

function hkdfExtract(salt, ikm) {
  return crypto.createHmac('sha256', salt).update(ikm).digest();
}
function hkdfExpand(prk, info, length) {
  const out = [];
  let block = Buffer.alloc(0);
  let counter = 1;
  while (out.reduce((n, b) => n + b.length, 0) < length) {
    block = crypto.createHmac('sha256', prk).update(Buffer.concat([block, info, Buffer.from([counter])])).digest();
    out.push(block);
    counter += 1;
  }
  return Buffer.concat(out).subarray(0, length);
}

function encryptPayload(text, keys) {
  const plaintext = Buffer.concat([Buffer.from(String(text || ''), 'utf8'), Buffer.from([0, 0])]);
  const salt = crypto.randomBytes(16);
  const sender = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const senderRaw = rawPointFromJwk(sender.publicKey.export({ format: 'jwk' }));
  const recvRaw = b64uDecode(keys.p256dh);
  const recipientPublic = crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: recvRaw.subarray(1, 33).toString('base64url'), y: recvRaw.subarray(33, 65).toString('base64url'), ext: true },
    format: 'jwk'
  });
  const shared = crypto.diffieHellman({ privateKey: sender.privateKey, publicKey: recipientPublic });
  const context = Buffer.concat([
    Buffer.from('P-256'), Buffer.from([0]),
    Buffer.from([0, recvRaw.length]), recvRaw,
    Buffer.from([0, senderRaw.length]), senderRaw
  ]);
  const prk = hkdfExtract(salt, shared);
  const cek = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm'), Buffer.from([0]), context]), 16);
  const nonce = hkdfExpand(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce'), Buffer.from([0]), context]), 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const sealed = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096, 0);
  const body = Buffer.concat([salt, rs, Buffer.from([senderRaw.length]), senderRaw, sealed]);
  return body;
}

function signVapidToken(audience) {
  const v = vapidKeys();
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = enc(header) + '.' + enc(claims);
  const signature = crypto.createSign('SHA256').update(signingInput).sign({ key: v.privateKey, dsaEncoding: 'ieee-p1363' });
  return { token: signingInput + '.' + Buffer.from(signature).toString('base64url'), publicB64: v.publicB64 };
}

async function webPushSend(subscription, text) {
  const endpoint = String(subscription && subscription.endpoint || '').trim();
  if (!endpoint) throw new Error('No endpoint.');
  const url = new URL(endpoint);
  const body = encryptPayload(text.slice(0, PUSH_LIMITS.maxCiphertext), subscription.keys || {});
  const { token, publicB64 } = signVapidToken(url.origin);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'vapid t=' + token + ', k=' + publicB64,
      TTL: String(PUSH_LIMITS.ttlSeconds),
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm'
    },
    body
  });
  if (response.status >= 400 && response.status !== 404 && response.status !== 410) {
    throw new Error('push service returned ' + response.status);
  }
  return response.status;
}

function prunePushRegistries() {
  const now = Date.now();
  for (const [peerId, subs] of pushSubs) {
    const kept = (subs || []).filter((s) => now - Number(s.at || 0) < PUSH_LIMITS.ttlSeconds * 1000);
    if (kept.length) pushSubs.set(peerId, kept);
    else pushSubs.delete(peerId);
  }
}
setInterval(prunePushRegistries, 60 * 60 * 1000).unref();

async function handlePushApi(pathname, request, response) {
  if (!isPrivateSource(request.socket.remoteAddress || '')) {
    return sendJson(response, 403, { ok: false, error: 'LAN only.' });
  }
  if (pathname === '/api/push/vapid' && request.method === 'GET') {
    return sendJson(response, 200, { ok: true, key: vapidKeys().publicB64 });
  }
  if (pathname === '/api/push/register' && request.method === 'POST') {
    return readBody(request).then((body) => {
      const peerId = String(body.peerId || '').trim().slice(0, 64);
      const sub = body.subscription;
      if (!peerId || !sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
        return sendJson(response, 400, { ok: false, error: 'peerId + subscription required.' });
      }
      const entry = { endpoint: String(sub.endpoint).slice(0, 512), keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) }, at: Date.now(), sendsHour: [] };
      const subs = (pushSubs.get(peerId) || []).filter((s) => s.endpoint !== entry.endpoint);
      subs.push(entry);
      if (subs.length > 8) subs.splice(0, subs.length - 8);
      pushSubs.set(peerId, subs);
      return sendJson(response, 200, { ok: true, peerId, devices: subs.length });
    }).catch((error) => sendJson(response, 400, { ok: false, error: error.message }));
  }
  if (pathname === '/api/push/register' && request.method === 'DELETE') {
    return readBody(request).then((body) => {
      const peerId = String(body.peerId || '').trim();
      const endpoint = String(body.endpoint || '');
      if (peerId && pushSubs.has(peerId)) {
        const subs = (pushSubs.get(peerId) || []).filter((s) => !endpoint || s.endpoint !== endpoint);
        if (subs.length) pushSubs.set(peerId, subs);
        else pushSubs.delete(peerId);
      }
      return sendJson(response, 200, { ok: true });
    }).catch((error) => sendJson(response, 400, { ok: false, error: error.message }));
  }
  if (pathname === '/api/push/send' && request.method === 'POST') {
    return readBody(request).then(async (body) => {
      const ids = [];
      if (body.peerId) ids.push(String(body.peerId));
      if (Array.isArray(body.peerIds)) ids.push(...body.peerIds.map(String));
      const text = String(body.text || '').slice(0, 4000);
      // Structured payload for the service worker: title/body/tag/url.
      // Stay under the ~4 KB push payload budget — DMs carry a label only;
      // contents are pulled from the room once the recipient reconnects.
      const payload = JSON.stringify({
        v: 1,
        title: String(body.title || '').slice(0, 80) || 'eclipsed.',
        body: text,
        tag: String(body.tag || '').slice(0, 80),
        url: String(body.url || '/').slice(0, 300)
      });
      const results = { ok: true, attempts: 0, sent: 0, failed: 0, unreachable: 0 };
      const now = Date.now();
      for (const id of ids) {
        const subs = pushSubs.get(id) || [];
        for (const sub of subs) {
          results.attempts += 1;
          sub.sendsHour = (sub.sendsHour || []).filter((t) => now - t < 3600 * 1000);
          if (sub.sendsHour.length >= PUSH_LIMITS.sendsPerRecipientHour) { results.failed += 1; continue; }
          sub.sendsHour.push(now);
          try {
            await webPushSend(sub, payload);
            results.sent += 1;
          } catch (error) {
            if (error && (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EAI_AGAIN')) results.unreachable += 1;
            else results.failed += 1;
          }
        }
      }
      return sendJson(response, 200, results);
    }).catch((error) => sendJson(response, 400, { ok: false, error: error.message }));
  }
  return sendJson(response, 404, { ok: false, error: 'Not found.' });
}

const server = http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch (error) { return sendJson(response, 400, { ok: false, error: 'Bad path.' }); }

  if (pathname === '/api/admin' || pathname.indexOf('/api/admin/') === 0) {
    return handleAdminApi(pathname, request, response);
  }

  if (pathname === '/api/push' || pathname.indexOf('/api/push/') === 0) {
    return handlePushApi(pathname, request, response);
  }

  if (pathname === '/lan' || pathname.indexOf('/lan/') === 0) {
    return handleApi(pathname, request, response, request.socket.remoteAddress || '');
  }

  // The worker is embedded in this SVG: answer service-worker fetches of the
  // app URL (plus /sw.js · /sw.svg aliases) with the embedded block as JS.
  if (pathname === '/index.svg' && isServiceWorkerFetch(request)) {
    return serveEmbeddedWorker(response);
  }
  if (pathname === '/sw.js' || pathname === '/sw.svg') {
    return serveEmbeddedWorker(response);
  }

  // Browsers auto-request a favicon and log a 404 console error when none
  // exists; answer politely so the app boots without console noise.
  if (pathname === '/favicon.ico') {
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    return response.end();
  }

  let filePath;
  if (pathname === '/' || pathname === '/index.svg') filePath = path.join(STATIC_ROOT, 'index.svg');
  else filePath = path.join(STATIC_ROOT, pathname);
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) {
    return sendJson(response, 403, { ok: false, error: 'Forbidden.' });
  }
  return sendStatic(response, filePath);
});

server.listen(PORT, HOST, () => {
  console.log('\neclipsed. — LAN room directory + app host');
  console.log('  Room endpoints serve LAN clients only (private addresses).');
  console.log('  Open the app from any device on this network at:');
  lanUrls().forEach((url) => console.log('    ' + url));
  if (HOST === '0.0.0.0') console.log('  (listener bound to all interfaces — override with HOST=192.168.x.y)');
  console.log('');
});

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 300).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
