import {
  buildCookie,
  buildSetCookie,
  constantTimeEqual,
  isJsonRequest,
  isSecureRequest,
  jsonResponse,
  sha256Hex,
  textResponse,
} from './_util';
import { createSessionToken, sessionCookieName } from './_session';

type Env = {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_PASSWORD_SHA256?: string;
  SESSION_SECRET?: string;
  SESSION_TTL_SECONDS?: string;
  NAV_CONFIG_KV?: KVNamespace;
  LOGIN_RATE_LIMIT_WINDOW_SECONDS?: string;
  LOGIN_RATE_LIMIT_MAX_FAILS?: string;
  LOGIN_RATE_LIMIT_LOCK_SECONDS?: string;
  ALLOW_DEV_DEFAULT_ADMIN?: string;
  DEV_ADMIN_USERNAME?: string;
  DEV_ADMIN_PASSWORD?: string;
  DEV_SESSION_SECRET?: string;
};

type LoginBody = {
  username?: unknown;
  password?: unknown;
};

type LoginRateState = {
  failCount: number;
  windowStartMs: number;
  lockUntilMs: number;
};

const LOGIN_RATE_KEY_PREFIX = 'login_rate_v1';

function getNumberEnv(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const n = Number(envValue);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function getClientIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf && cf.trim()) return cf.trim();

  const xff = request.headers.get('x-forwarded-for');
  if (xff && xff.trim()) return xff.split(',')[0]?.trim() ?? '';

  return '';
}

async function readRateState(kv: KVNamespace, key: string): Promise<LoginRateState | null> {
  const raw = await kv.get(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const obj = parsed as Record<string, unknown>;
    const failCount = typeof obj.failCount === 'number' ? obj.failCount : 0;
    const windowStartMs = typeof obj.windowStartMs === 'number' ? obj.windowStartMs : 0;
    const lockUntilMs = typeof obj.lockUntilMs === 'number' ? obj.lockUntilMs : 0;

    return {
      failCount: Number.isFinite(failCount) ? failCount : 0,
      windowStartMs: Number.isFinite(windowStartMs) ? windowStartMs : 0,
      lockUntilMs: Number.isFinite(lockUntilMs) ? lockUntilMs : 0,
    };
  } catch {
    return null;
  }
}

function getTtlSeconds(env: Env): number {
  const raw = env.SESSION_TTL_SECONDS;
  if (!raw) return 60 * 60 * 24;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 60 * 60 * 24;
  return Math.floor(n);
}



async function resolveAdminAuth(
  env: Env,
): Promise<{ username: string; passwordSha256: string; sessionSecret: string; isDevDefault: boolean } | null> {
  const username = env.ADMIN_USERNAME;
  const passwordSha256 = env.ADMIN_PASSWORD_SHA256;
  const sessionSecret = env.SESSION_SECRET;

  if (username && passwordSha256 && sessionSecret) {
    return { username, passwordSha256, sessionSecret, isDevDefault: false };
  }

  // Default admin/admin2026 for both dev and demo
  const defaultUsername = env.ADMIN_USERNAME || 'admin';
  const defaultPassword = env.ADMIN_PASSWORD || 'admin2026';
  const defaultPasswordSha256 = passwordSha256 || await sha256Hex(defaultPassword);
  const defaultSessionSecret = env.SESSION_SECRET || 'nav-du-session-secret-2026';

  return {
    username: defaultUsername,
    passwordSha256: defaultPasswordSha256,
    sessionSecret: defaultSessionSecret,
    isDevDefault: true,
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isJsonRequest(request)) return textResponse('Expected application/json', 415);

  const auth = await resolveAdminAuth(env);
  if (!auth) {
    return jsonResponse({ error: 'admin not configured' }, 500);
  }

  const adminUser = auth.username;
  const adminHash = auth.passwordSha256;
  const secret = auth.sessionSecret;

  const data = (await request.json()) as LoginBody;
  const username = typeof data.username === 'string' ? data.username : '';
  const password = typeof data.password === 'string' ? data.password : '';

  const kv = env.NAV_CONFIG_KV;
  const clientIp = getClientIp(request);
  const rateKey = `${LOGIN_RATE_KEY_PREFIX}:${clientIp || 'unknown'}`;
  const windowSeconds = getNumberEnv(env.LOGIN_RATE_LIMIT_WINDOW_SECONDS, 60);
  const maxFails = getNumberEnv(env.LOGIN_RATE_LIMIT_MAX_FAILS, 8);
  const lockSeconds = getNumberEnv(env.LOGIN_RATE_LIMIT_LOCK_SECONDS, 5 * 60);

  if (kv && clientIp) {
    const state = await readRateState(kv, rateKey);
    if (state && state.lockUntilMs > Date.now()) {
      const retryAfter = Math.max(1, Math.ceil((state.lockUntilMs - Date.now()) / 1000));
      return jsonResponse({ error: 'too many attempts' }, 429, { 'retry-after': String(retryAfter) });
    }
  }

  const userBytes = new TextEncoder().encode(username);
  const adminBytes = new TextEncoder().encode(adminUser);

  const computed = await sha256Hex(password);
  const computedBytes = new TextEncoder().encode(computed);
  const expectedBytes = new TextEncoder().encode(adminHash.toLowerCase());

  const usernameOk = constantTimeEqual(userBytes, adminBytes);
  const passwordOk = constantTimeEqual(computedBytes, expectedBytes);

  if (!usernameOk || !passwordOk) {
    if (kv && clientIp) {
      const now = Date.now();
      const prev = (await readRateState(kv, rateKey)) ?? { failCount: 0, windowStartMs: now, lockUntilMs: 0 };

      const withinWindow = prev.windowStartMs > 0 && now - prev.windowStartMs <= windowSeconds * 1000;
      const nextFailCount = withinWindow ? prev.failCount + 1 : 1;
      const windowStartMs = withinWindow ? prev.windowStartMs : now;

      const lockUntilMs = nextFailCount >= maxFails ? now + lockSeconds * 1000 : 0;
      const next: LoginRateState = { failCount: nextFailCount, windowStartMs, lockUntilMs };

      await kv.put(rateKey, JSON.stringify(next), { expirationTtl: windowSeconds + lockSeconds + 60 });

      if (lockUntilMs > now) {
        const retryAfter = Math.max(1, Math.ceil((lockUntilMs - now) / 1000));
        return jsonResponse({ error: 'too many attempts' }, 429, { 'retry-after': String(retryAfter) });
      }
    } else {
      await new Promise((r) => setTimeout(r, 250));
    }

    return jsonResponse({ error: 'invalid credentials' }, 401);
  }

  if (kv && clientIp) {
    await kv.delete(rateKey);
  }

  const ttl = getTtlSeconds(env);
  const exp = Date.now() + ttl * 1000;

  const token = await createSessionToken(secret, { u: username, exp });
  const cookie = buildCookie(sessionCookieName, token, ttl, isSecureRequest(request));

  return jsonResponse({ ok: true, username }, 200, buildSetCookie(cookie));
};
