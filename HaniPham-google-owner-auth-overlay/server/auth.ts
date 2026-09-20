import type { Env } from './types';
import { HttpError, cookie, cookies, json, randomToken, requireConfig, requireDatabase, secureEqual, sha256 } from './http';

const SESSION = 'hani_owner_session';
const OAUTH = 'hani_google_oauth';
const SESSION_AGE = 8 * 60 * 60;
const STATE_AGE = 10 * 60;
const authScopes = 'openid email profile';

function googleConfig(env: Env, origin: string) {
  const id = requireConfig(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID');
  const secret = requireConfig(env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET');
  const owner = requireConfig(env.OWNER_GOOGLE_EMAIL, 'OWNER_GOOGLE_EMAIL');
  const canonical = requireConfig(env.SITE_ORIGIN, 'SITE_ORIGIN');
  if (!origin.startsWith('https://') || canonical !== origin) throw new HttpError(403, 'Unexpected site origin');
  return { id, secret, owner, redirect: `${canonical}/api/auth/google/callback` };
}

export async function login(request: Request, env: Env) {
  requireDatabase(env.DB);
  const origin = new URL(request.url).origin;
  const cfg = googleConfig(env, origin);
  const state = randomToken();
  const verifier = randomToken(48);
  const challengeBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const challenge = btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const params = new URLSearchParams({ client_id: cfg.id, redirect_uri: cfg.redirect, response_type: 'code', scope: authScopes, state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' });
  const value = `${state}.${verifier}`;
  return new Response(null, { status: 302, headers: { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'Set-Cookie': cookie(OAUTH, value, STATE_AGE), 'Cache-Control': 'no-store' } });
}

export async function callback(request: Request, env: Env) {
  const url = new URL(request.url);
  const cfg = googleConfig(env, url.origin);
  const redirect = (error?: string) => new Response(null, { status: 302, headers: { Location: `/?upload=1${error ? `&auth_error=${encodeURIComponent(error)}` : ''}`, 'Set-Cookie': cookie(OAUTH, '', 0), 'Cache-Control': 'no-store' } });
  const oauth = cookies(request)[OAUTH];
  const parts = oauth?.split('.') ?? [];
  const returnedState = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code');
  if (parts.length !== 2 || !returnedState || !(await secureEqual(parts[0], returnedState)) || !code || url.searchParams.has('error')) return redirect('Đăng nhập không thành công hoặc đã hết hạn.');
  const exchange = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: cfg.id, client_secret: cfg.secret, redirect_uri: cfg.redirect, grant_type: 'authorization_code', code_verifier: parts[1] }) });
  if (!exchange.ok) return redirect('Google không xác nhận được đăng nhập.');
  const token = await exchange.json() as { access_token?: string };
  if (!token.access_token) return redirect('Không nhận được thông tin xác thực.');
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!profileResponse.ok) return redirect('Không xác minh được tài khoản Google.');
  const profile = await profileResponse.json() as { sub?: string; email?: string; email_verified?: boolean | string };
  const allowed = profile.email_verified === true && !!profile.sub && profile.email?.toLowerCase() === cfg.owner.toLowerCase() && (!env.OWNER_GOOGLE_SUB || profile.sub === env.OWNER_GOOGLE_SUB);
  if (!allowed) return redirect('Tài khoản Google này không có quyền quản lý.');
  const db = requireDatabase(env.DB);
  const session = randomToken(48);
  const expires = Date.now() + SESSION_AGE * 1000;
  await db.prepare('INSERT INTO admin_sessions (token_hash, google_sub, email, expires_at) VALUES (?, ?, ?, ?)').bind(await sha256(session), profile.sub!, profile.email!, expires).run();
  const response = redirect();
  response.headers.append('Set-Cookie', cookie(SESSION, session, SESSION_AGE, 'Strict'));
  return response;
}

export async function owner(request: Request, env: Env) {
  const session = cookies(request)[SESSION];
  if (!session) throw new HttpError(401, 'Owner sign-in required');
  const db = requireDatabase(env.DB);
  const found = await db.prepare('SELECT email, google_sub, expires_at FROM admin_sessions WHERE token_hash = ?').bind(await sha256(session)).first<{email: string; google_sub: string; expires_at: number}>();
  if (!found || found.expires_at <= Date.now() || found.email.toLowerCase() !== env.OWNER_GOOGLE_EMAIL?.toLowerCase() || (env.OWNER_GOOGLE_SUB && found.google_sub !== env.OWNER_GOOGLE_SUB)) throw new HttpError(401, 'Owner session expired or revoked');
  return found;
}

export async function session(request: Request, env: Env) {
  try { const found = await owner(request, env); return json({ authorized: true, expiresAt: new Date(found.expires_at).toISOString(), demo: false, ownerEmail: found.email }); }
  catch (error) { if (error instanceof HttpError && [401, 503].includes(error.status)) return json({ authorized: false, expiresAt: '', demo: false }); throw error; }
}

export async function logout(request: Request, env: Env) {
  const token = cookies(request)[SESSION];
  if (token && env.DB) await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION, '', 0, 'Strict') });
}
