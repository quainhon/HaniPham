import type { BasketItem } from '../src/types';
export interface Database {
  prepare(sql: string): Statement;
}
export interface Statement {
  bind(...args: (string | number | null)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Env {
  DB?: Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  OWNER_GOOGLE_EMAIL?: string;
  OWNER_GOOGLE_SUB?: string;
  SITE_ORIGIN?: string;
  DRIVE_REFRESH_TOKEN?: string;
  DRIVE_SONGS_FOLDER_ID?: string;
  DRIVE_PHOTOS_FOLDER_ID?: string;
  DRIVE_COVERS_FOLDER_ID?: string;
}
export interface RecordRow {
  id: string;
  type: 'song' | 'photo';
  title: string;
  artist: string | null;
  caption: string;
  tags: string;
  mood: string;
  duration_sec: number | null;
  published_at: string;
  is_published: number;
  favorite_count: number;
  play_count: number;
  drive_file_id: string;
  cover_drive_file_id: string | null;
  deleted_at: string | null;
}
export type PublicItem = BasketItem;
export type JsonError = {error: string};
