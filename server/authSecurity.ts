import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response, NextFunction } from 'express';
import { DATA_DIR } from './db.ts';

const SECRET_FILE = path.join(DATA_DIR, '.session_secret');

function loadOrCreateSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const existing = fs.readFileSync(SECRET_FILE, 'utf-8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.randomBytes(32).toString('hex');
  }
}

const SESSION_SECRET = loadOrCreateSessionSecret();
const TOKEN_TTL_SEC = 60 * 60 * 24 * 365; // 1 year persistent session on user's trusted device!

/**
 * Zero-dependency Scrypt password hashing (Node built-in crypto, $0 / 0 external packages!)
 */
export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function isHashedPassword(stored: string): boolean {
  return stored.startsWith('scrypt$') && stored.split('$').length === 3;
}

export function verifyPassword(plain: string, stored: string): boolean {
  if (!stored) return false;
  if (isHashedPassword(stored)) {
    const [, salt, hashHex] = stored.split('$');
    const derived = crypto.scryptSync(plain, salt, 64);
    const expected = Buffer.from(hashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  }
  // Backward-compatible verification for seeded local accounts (auto-upgraded on login!)
  const a = Buffer.from(plain);
  const b = Buffer.from(stored);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Signed HMAC-SHA256 compact session token (JWT-style, zero external libraries)
 */
export function signSessionToken(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'LM' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifySessionToken(token: string | null | undefined): { userId: string } | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { sub?: string; exp?: number };
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: decoded.sub };
  } catch {
    return null;
  }
}

export function extractRequestToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)lm_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function extractDeviceId(req: Request): string | null {
  const fromHeader = String(req.headers['x-lm-device-id'] || '').trim();
  if (/^[A-Za-z0-9_-]{10,64}$/.test(fromHeader)) return fromHeader;
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)lm_device=([^;]+)/);
  if (match) {
    const val = decodeURIComponent(match[1]).trim();
    if (/^[A-Za-z0-9_-]{10,64}$/.test(val)) return val;
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, deviceId?: string | null): void {
  const isProd = process.env.NODE_ENV === 'production';
  const isHfSpace = Boolean(process.env.SPACE_ID);
  const common = [
    'Path=/',
    'HttpOnly',
    isHfSpace ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${TOKEN_TTL_SEC}`,
    ...(isProd || isHfSpace ? ['Secure'] : []),
  ];
  const cookies = [`lm_session=${encodeURIComponent(token)}; ${common.join('; ')}`];
  if (deviceId && /^[A-Za-z0-9_-]{10,64}$/.test(deviceId)) {
    cookies.push(`lm_device=${encodeURIComponent(deviceId)}; ${common.join('; ')}`);
  }
  res.setHeader('Set-Cookie', cookies);
}

export function clearSessionCookie(res: Response): void {
  const isHfSpace = Boolean(process.env.SPACE_ID);
  const attrs = [
    'lm_session=',
    'Path=/',
    'HttpOnly',
    isHfSpace ? 'SameSite=None; Secure' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

/**
 * Zero-cost sliding-window in-memory rate limiter (ideal for Phase 1 friend launches!)
 */
export function createRateLimiter(opts: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, number[]>();

  // Periodic lightweight cleanup to keep memory flat
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - opts.windowMs;
    for (const [key, stamps] of buckets.entries()) {
      const fresh = stamps.filter(ts => ts > cutoff);
      if (fresh.length === 0) buckets.delete(key);
      else buckets.set(key, fresh);
    }
  }, Math.max(opts.windowMs, 30_000));
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local')
        .split(',')[0]
        .trim();
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const recent = (buckets.get(ip) || []).filter(ts => ts > cutoff);
    if (recent.length >= opts.max) {
      return res.status(429).json({
        ok: false,
        error: opts.message || 'طلبات كثيرة جدًا في وقت قصير، يرجى الانتظار قليلًا.',
      });
    }
    recent.push(now);
    buckets.set(ip, recent);
    next();
  };
}
