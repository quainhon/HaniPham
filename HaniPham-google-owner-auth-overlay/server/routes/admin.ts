import type { Env, RecordRow } from '../types';
import { HttpError, json, requireConfig, requireDatabase } from '../http';
import { owner } from '../auth';
import { uploadFile, validateFile, driveToken } from '../drive/files';
import { getRow, insertRow, listRows, publicMedia } from '../repository';

function parseStrings(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20 || value.some(x => typeof x !== 'string' || x.length > 60)) throw new HttpError(400, 'Invalid tags or mood');
  return value.map(x => x.trim()).filter(Boolean);
}
function bounded(value: unknown, name: string, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(400, `Invalid ${name}`);
  return value.trim();
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new HttpError(400, 'Invalid publication state');
  return value;
}
function isFile(value: FormDataEntryValue | null): value is File { return value instanceof File && value.size > 0; }

export async function adminRoute(request: Request, env: Env): Promise<Response> {
  // This is independently enforced on EVERY read/write admin route.
  await owner(request, env);
  const db = requireDatabase(env.DB);
  const path = new URL(request.url).pathname;
  if (path === '/api/admin/media' && request.method === 'GET') return json((await listRows(db, true)).map(publicMedia));
  const match = path.match(/^\/api\/admin\/media\/([^/]+)$/);
  if (match && request.method === 'PATCH') {
    if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) throw new HttpError(415, 'JSON required');
    const row = await getRow(db, decodeURIComponent(match[1]), true);
    if (!row) throw new HttpError(404, 'Media not found');
    const changes = await request.json() as Record<string, unknown>;
    const allowed = ['title', 'caption', 'artist', 'tags', 'mood', 'isPublished'];
    if (Object.keys(changes).some(k => !allowed.includes(k))) throw new HttpError(400, 'Unknown or protected field');
    const updates: string[] = [];
    const args: (string | number | null)[] = [];
    function set(column: string, value: string | number | null) { updates.push(`${column} = ?`); args.push(value); }
    if ('title' in changes) set('title', bounded(changes.title, 'title', 150, true));
    if ('caption' in changes) set('caption', bounded(changes.caption, 'caption', 600));
    if ('artist' in changes && row.type === 'song') set('artist', bounded(changes.artist, 'artist', 100));
    if ('tags' in changes) set('tags', JSON.stringify(parseStrings(changes.tags)));
    if ('mood' in changes) set('mood', JSON.stringify(parseStrings(changes.mood)));
    if ('isPublished' in changes) set('is_published', Number(bool(changes.isPublished)));
    if (!updates.length) throw new HttpError(400, 'No changes');
    await db.prepare(`UPDATE media SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`).bind(...args, row.id).run();
    return json(publicMedia((await getRow(db, row.id, true))!));
  }
  if (match && request.method === 'DELETE') {
    const row = await getRow(db, decodeURIComponent(match[1]), true);
    if (!row) throw new HttpError(404, 'Media not found');
    // No Drive deletion: reversible, hides in all public projections.
    await db.prepare('UPDATE media SET deleted_at = ?, is_published = 0 WHERE id = ?').bind(new Date().toISOString(), row.id).run();
    return json({ok: true, driveFilePreserved: true});
  }
  const upload = path.match(/^\/api\/admin\/upload\/(song|photo)$/);
  if (!upload || request.method !== 'POST') throw new HttpError(404, 'Not found');
  const length = Number(request.headers.get('Content-Length') ?? 0);
  if (length > 34 * 1024 * 1024) throw new HttpError(413, 'Upload too large');
  if (!(request.headers.get('Content-Type') ?? '').startsWith('multipart/form-data')) throw new HttpError(415, 'Multipart required');
  // Reject unconfigured Drive access before buffering the multipart request.
  requireConfig(env.DRIVE_REFRESH_TOKEN, 'DRIVE_REFRESH_TOKEN');
  const type = upload[1] as 'song' | 'photo';
  const folder = requireConfig(type === 'song' ? env.DRIVE_SONGS_FOLDER_ID : env.DRIVE_PHOTOS_FOLDER_ID, `${type} folder`);
  if (type === 'song') requireConfig(env.DRIVE_COVERS_FOLDER_ID, 'DRIVE_COVERS_FOLDER_ID');
  const form = await request.formData();
  const raw = form.get('metadata');
  if (typeof raw !== 'string' || raw.length > 4096) throw new HttpError(400, 'Invalid metadata');
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw) as Record<string, unknown>; } catch { throw new HttpError(400, 'Malformed metadata'); }
  const title = bounded(data.title, 'title', 150, true);
  const artist = type === 'song' ? bounded(data.artist || 'Hani Pham', 'artist', 100) : null;
  const caption = bounded(data.caption ?? '', 'caption', 600);
  const tags = parseStrings(data.tags);
  const mood = parseStrings(data.mood);
  const published = bool(data.isPublished);
  const image = form.get('image');
  const audio = form.get('audio');
  if (!isFile(image)) throw new HttpError(400, 'Image required');
  await validateFile(image, 'image');
  if (type === 'song') { if (!isFile(audio)) throw new HttpError(400, 'Audio required'); await validateFile(audio, 'audio'); }
  // Access verified server-side, then files uploaded with separate Drive-only credentials.
  await driveToken(env);
  let audioId: string | undefined;
  let imageId: string | undefined;
  try {
    if (type === 'song' && isFile(audio)) audioId = await uploadFile(env, audio, folder);
    imageId = await uploadFile(env, image, type === 'song' ? env.DRIVE_COVERS_FOLDER_ID! : folder);
  } catch (error) {
    // Drive partial uploads are not deleted automatically; report for owner reconciliation.
    throw new HttpError(502, `Drive upload incomplete; please check Drive before retrying. ${error instanceof HttpError ? error.message : ''}`);
  }
  const record: RecordRow = { id: crypto.randomUUID(), type, title, artist, caption, tags: JSON.stringify(tags), mood: JSON.stringify(mood), duration_sec: null, published_at: new Date().toISOString(), is_published: Number(published), favorite_count: 0, play_count: 0, drive_file_id: type === 'song' ? audioId! : imageId!, cover_drive_file_id: type === 'song' ? imageId! : null, deleted_at: null };
  try { await insertRow(db, record); }
  catch { throw new HttpError(502, 'Drive upload succeeded but metadata insert failed; check Drive before retrying'); }
  return json(publicMedia(record), 201);
}
