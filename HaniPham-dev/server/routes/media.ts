import type { Env } from '../types';
import { HttpError, json, requireDatabase } from '../http';
import { deliverFile } from '../drive/files';
import { getRow, listPublic, publicMedia } from '../repository';
export async function publicRoute(request: Request, env: Env): Promise<Response> {
  const db = requireDatabase(env.DB);
  const { pathname, searchParams } = new URL(request.url);
  if (request.method !== 'GET' && request.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
  if (pathname === '/api/media') return json(await listPublic(db));
  if (pathname === '/api/media/latest') return json((await listPublic(db)).find(item => item.type === 'song') ?? null);
  if (pathname === '/api/media/popular') return json(await listPublic(db, 'popular'));
  if (pathname === '/api/media/search') return json(await listPublic(db, 'latest', (searchParams.get('q') ?? '').slice(0, 120)));
  const match = pathname.match(/^\/api\/media\/([^/]+)(?:\/(stream|cover))?$/);
  if (!match) throw new HttpError(404, 'Not found');
  const row = await getRow(db, decodeURIComponent(match[1]));
  if (!row) throw new HttpError(404, 'Not found');
  if (!match[2]) return json(publicMedia(row));
  if (match[2] === 'stream' && row.type !== 'song') throw new HttpError(404, 'Not found');
  const fileId = match[2] === 'cover' ? (row.cover_drive_file_id ?? (row.type === 'photo' ? row.drive_file_id : null)) : row.drive_file_id;
  if (!fileId) throw new HttpError(404, 'Not found');
  return deliverFile(env, fileId, request, match[2] === 'cover');
}
