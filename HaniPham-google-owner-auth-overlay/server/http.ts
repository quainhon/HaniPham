export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const noStore = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export function json(data: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(data, { status, headers: { ...noStore, ...extra } });
}
export function requireOrigin(request: Request, expected: string) {
  const origin = request.headers.get('Origin');
  if (origin !== expected) throw new HttpError(403, 'Invalid request origin');
}
export function requireDatabase<T>(db: T | undefined): T {
  if (!db) throw new HttpError(503, 'Metadata database is not configured');
  return db;
}
export function requireConfig(value: string | undefined, label: string): string {
  if (!value) throw new HttpError(503, `${label} is not configured`);
  return value;
}
export function cookies(request: Request): Record<string, string> {
  return Object.fromEntries((request.headers.get('Cookie') ?? '').split(';').map(x => x.trim().split(/=(.*)/s).slice(0, 2)).filter(x => x[0]));
}
export function randomToken(bytes = 32) {
  const array = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export async function sha256(s: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return [...bytes].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function secureEqual(a: string, b: string): Promise<boolean> {
  const [aa, bb] = await Promise.all([sha256(a), sha256(b)]);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  return difference === 0;
}
export function cookie(name: string, value: string, age: number, sameSite: 'Lax' | 'Strict' = 'Lax') {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${age}`;
}
