import type { BasketItem, Song } from '../src/types';
import { normalize } from '../src/lib';
import type { Database, RecordRow } from './types';

export function publicMedia(row: RecordRow): BasketItem {
  const base = { id: row.id, title: row.title, caption: row.caption, tags: JSON.parse(row.tags) as string[], mood: JSON.parse(row.mood) as string[], publishedAt: row.published_at, isPublished: row.is_published === 1, favoriteCount: row.favorite_count, imageUrl: `/api/media/${encodeURIComponent(row.id)}/cover` };
  return row.type === 'song' ? { ...base, type: 'song', artist: row.artist || 'Hani Pham', audioUrl: `/api/media/${encodeURIComponent(row.id)}/stream`, durationSec: row.duration_sec ?? undefined, playCount: row.play_count } : { ...base, type: 'photo' };
}
export async function listRows(db: Database, includeDrafts = false): Promise<RecordRow[]> {
  const result = await db.prepare(`SELECT * FROM media WHERE deleted_at IS NULL ${includeDrafts ? '' : 'AND is_published = 1'} ORDER BY published_at DESC`).all<RecordRow>();
  return result.results;
}
export async function getRow(db: Database, id: string, includeDraft = false) {
  return db.prepare(`SELECT * FROM media WHERE id = ? AND deleted_at IS NULL ${includeDraft ? '' : 'AND is_published = 1'}`).bind(id).first<RecordRow>();
}
export async function listPublic(db: Database, sort: string = 'latest', query = ''): Promise<BasketItem[]> {
  let items = (await listRows(db)).map(publicMedia);
  if (query) items = items.filter(item => normalize([item.title, item.caption, ...item.tags, ...item.mood, item.type === 'song' ? item.artist : ''].join(' ')).includes(normalize(query)));
  if (sort === 'popular') return items.filter((i): i is Song => i.type === 'song').sort((a, b) => b.favoriteCount - a.favoriteCount);
  return items;
}
export async function insertRow(db: Database, record: RecordRow) {
  await db.prepare(`INSERT INTO media (id,type,title,artist,caption,tags,mood,duration_sec,published_at,is_published,favorite_count,play_count,drive_file_id,cover_drive_file_id,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(record.id, record.type, record.title, record.artist, record.caption, record.tags, record.mood, record.duration_sec, record.published_at, record.is_published, record.favorite_count, record.play_count, record.drive_file_id, record.cover_drive_file_id, record.deleted_at).run();
}
