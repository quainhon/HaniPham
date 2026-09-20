import type { Env } from '../types';
import { HttpError, requireConfig } from '../http';

let tokenCache: { refresh: string; token: string; expires: number } | undefined;
export async function driveToken(env: Env): Promise<string> {
  const refresh = requireConfig(env.DRIVE_REFRESH_TOKEN, 'DRIVE_REFRESH_TOKEN');
  if (tokenCache?.refresh === refresh && tokenCache.expires > Date.now()) return tokenCache.token;
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: requireConfig(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID'), client_secret: requireConfig(env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token' }) });
  if (!response.ok) throw new HttpError(503, 'Drive authorization unavailable');
  const data = await response.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new HttpError(503, 'Drive access token missing');
  tokenCache = { refresh, token: data.access_token, expires: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 90) * 1000 };
  return data.access_token;
}
const MIME_AUDIO = ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/x-wav'];
const MIME_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
export async function validateFile(file: File, kind: 'audio' | 'image') {
  const types = kind === 'audio' ? MIME_AUDIO : MIME_IMAGE;
  // Worker formData() buffers multipart file data; intentionally cap below memory pressure levels.
  const max = kind === 'audio' ? 24 * 1024 * 1024 : 8 * 1024 * 1024;
  if (!(file instanceof File) || file.size === 0 || file.size > max || !types.includes(file.type)) throw new HttpError(400, `${kind === 'audio' ? 'Audio' : 'Image'} type or size not permitted`);
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const chars = (start: number, len: number) => String.fromCharCode(...bytes.slice(start, start + len));
  const valid = file.type === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : file.type === 'image/png' ? bytes[0] === 0x89 && chars(1,3) === 'PNG'
    : file.type === 'image/webp' ? chars(0,4) === 'RIFF' && chars(8,4) === 'WEBP'
    : file.type === 'audio/mpeg' ? chars(0,3) === 'ID3' || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
    : file.type === 'audio/ogg' ? chars(0,4) === 'OggS'
    : file.type === 'audio/mp4' ? chars(4,4) === 'ftyp'
    : ['audio/wav','audio/x-wav'].includes(file.type) ? chars(0,4) === 'RIFF' && chars(8,4) === 'WAVE' : false;
  if (!valid) throw new HttpError(400, 'File signature does not match its declared format');
}
export async function uploadFile(env: Env, file: File, folder: string): Promise<string> {
  const token = await driveToken(env);
  // Resumable initiation + stream actual bytes. Avoid base64 and body-array buffering.
  const initiate = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': file.type, 'X-Upload-Content-Length': String(file.size) }, body: JSON.stringify({ name: file.name, parents: [folder], mimeType: file.type }) });
  const location = initiate.headers.get('Location');
  if (!initiate.ok || !location?.startsWith('https://www.googleapis.com/')) throw new HttpError(502, 'Drive upload initialization failed');
  const response = await fetch(location, { method: 'PUT', headers: { 'Content-Type': file.type, 'Content-Length': String(file.size) }, body: file.stream() });
  if (!response.ok) throw new HttpError(502, 'Drive upload failed');
  const result = await response.json() as { id?: string };
  if (!result.id) throw new HttpError(502, 'Drive did not return a file ID');
  return result.id;
}
export async function deliverFile(env: Env, fileId: string, request: Request, image: boolean) {
  const headers = new Headers({ Authorization: `Bearer ${await driveToken(env)}` });
  const range = request.headers.get('Range');
  if (range && !image) {
    if (!/^bytes=\d*-\d*$/.test(range)) throw new HttpError(416, 'Invalid range');
    headers.set('Range', range);
  }
  const upstream = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
  if (upstream.status === 416) return new Response(null, {status:416, headers:{'Content-Range':upstream.headers.get('Content-Range') ?? 'bytes */*','Cache-Control':'no-store'}});
  if (!upstream.ok) throw new HttpError(upstream.status === 404 ? 404 : 502, 'Media unavailable');
  if (range && !image && upstream.status === 200) throw new HttpError(502, 'Drive did not honor audio range');
  const output = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" });
  for (const name of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) { const value = upstream.headers.get(name); if (value) output.set(name, value); }
  const contentType = output.get('Content-Type') ?? '';
  if (!(image ? contentType.startsWith('image/') : contentType.startsWith('audio/'))) throw new HttpError(502, 'Unexpected Drive media type');
  return new Response(upstream.body, { status: upstream.status, headers: output });
}
