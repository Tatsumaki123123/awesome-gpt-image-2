import crypto from 'node:crypto';
import { config } from './config.js';
import { query } from './db.js';

const SESSION_COOKIE = 'agi_admin';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(value) {
  return crypto
    .createHmac('sha256', config.admin.sessionSecret)
    .update(value)
    .digest('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function passwordHash(password) {
  return sha256(`admin-password:${password}`);
}

export function verifyAdminPassword(password) {
  if (config.admin.passwordHash) {
    return safeEqual(passwordHash(password), config.admin.passwordHash);
  }
  return safeEqual(password, config.admin.password);
}

export function createAdminSession(username) {
  const payload = {
    sub: username,
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminSession(token) {
  const [encoded, signature] = String(token || '').split('.');
  if (!encoded || !signature || !safeEqual(signature, sign(encoded))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (payload.role !== 'admin') return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ].join('; ');
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=');
        return index === -1
          ? [item, '']
          : [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

export function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const session = verifyAdminSession(cookies[SESSION_COOKIE]);
  if (!session) {
    res.status(401).json({ ok: false, error: 'ADMIN_AUTH_REQUIRED' });
    return;
  }
  req.admin = session;
  next();
}

export function hashApiKey(key) {
  return sha256(`api-key:${key}`);
}

export function createApiKeySecret() {
  return `agi_${crypto.randomBytes(24).toString('base64url')}`;
}

export async function requireApiKey(req, res, next) {
  if (!config.server.publicApiRequireKey) {
    next();
    return;
  }

  const rawKey = req.headers['x-api-key'] || req.query.apiKey || req.query.api_key;
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
  if (!key) {
    res.status(401).json({ ok: false, error: 'API_KEY_REQUIRED' });
    return;
  }

  const { rows } = await query(
    `
      update api_keys
         set last_used_at = now()
       where key_hash = $1
         and revoked_at is null
         and (expires_at is null or expires_at > now())
       returning id, name, scopes
    `,
    [hashApiKey(key)]
  );

  if (!rows[0]) {
    res.status(401).json({ ok: false, error: 'INVALID_API_KEY' });
    return;
  }

  req.apiKey = rows[0];
  next();
}

