-- Apply locally first; no migration has been executed on an external database.
CREATE TABLE IF NOT EXISTS media (
 id TEXT PRIMARY KEY,
 type TEXT NOT NULL CHECK(type IN ('song','photo')),
 title TEXT NOT NULL,
 artist TEXT,
 caption TEXT NOT NULL DEFAULT '',
 tags TEXT NOT NULL DEFAULT '[]',
 mood TEXT NOT NULL DEFAULT '[]',
 duration_sec INTEGER,
 published_at TEXT NOT NULL,
 is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1)),
 favorite_count INTEGER NOT NULL DEFAULT 0,
 play_count INTEGER NOT NULL DEFAULT 0,
 drive_file_id TEXT NOT NULL,
 cover_drive_file_id TEXT,
 deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS media_public ON media(is_published, deleted_at, published_at);
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash TEXT PRIMARY KEY,
 google_sub TEXT NOT NULL,
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS tributes (
 id TEXT PRIMARY KEY,
 display_name TEXT NOT NULL,
 anonymous INTEGER NOT NULL DEFAULT 0,
 message TEXT NOT NULL,
 timestamp TEXT NOT NULL,
 visibility TEXT NOT NULL DEFAULT 'hidden' CHECK(visibility IN ('approved','hidden')),
 payment_verified INTEGER NOT NULL DEFAULT 0
);
