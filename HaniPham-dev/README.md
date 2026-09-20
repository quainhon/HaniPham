# Hani Pham — FULL UI + one-owner Google authentication + Drive/D1 backend

This directory **is the complete project root**, not a patch or overlay. Extract its contents **directly beside `.git/`** in `quainhon/HaniPham`. Do not upload a wrapping folder. Frontend files (`package.json`, `package-lock.json`, `index.html`, `vite.config.ts`, `src/`, `public/images/`, `public/fonts/`) and backend files (`server/`, `migrations/`, `wrangler.json`) are included. No real Google account, D1 database, or deployment has been touched.

## Run and demo deploy (no real Google connection)

Node 22+ is recommended. In the repository root:

```bash
npm ci
npm run check:backend
npm run build
npm test
```

Run `npm run dev` for local UI. A Worker deployment uses `npx wrangler deploy` after `npm run build` and must be done only after reviewing the actual Cloudflare account, worker, domain, and build settings. Cloudflare Git integration: **root directory `/`**, build `npm run build`, deploy `npx wrangler deploy`. Worker name is `hanipham`; attach `hanipham.quainhon.com` only after testing the `workers.dev` preview. `wrangler.json` serves `dist/` and routes `/api/*` to `server/worker.ts`.

Default **`VITE_MEDIA_SOURCE=mock`** intentionally shows demo music/photos and simulated owner mode. The demo owner button is **not Google sign-in**, and demo files are lost on refresh. Real API endpoints fail closed when D1/secrets are not configured. The mock source is for visual testing only, not an authorization layer. Do not claim the demo upload is a real Drive upload.

## UI and source of truth

The uploaded new UI is preserved, including Beige/Đêm switch, hero artwork, wicker postcard basket, selection/dragging/shuffle/search, shared audio player, donation/tribute, all original images and all 7 local font binaries. Only the admin/upload flow changed: one Google sign-in button instead of a control key; once authorized, owner can upload, edit title/caption, publish/hide and soft-archive media. Archives never delete original Drive files.

The supplied hero treatment is cropped from the approved design reference, not an independently verified original Hani photograph. Demo music/photo names, images and tributes are illustrative. No genuine recordings or Google credentials are bundled. Historic PNG screenshots in `tests/` belong to the supplied original UI; they do not prove the integrated auth flow.

## Identity and Drive are separate permissions

**Public listeners:** no account required. **Owner:** use Google OAuth authorization-code + state + PKCE S256; scopes `openid email profile`. Google returns the identity server-side. Only Google's `email_verified === true` AND the exact `OWNER_GOOGLE_EMAIL` (and optionally immutable `OWNER_GOOGLE_SUB`) can create a session. D1 stores hashes of opaque session tokens, 8-hour expiry; cookies are `HttpOnly`, `Secure`, `SameSite=Strict`; every owner endpoint checks session, every state-changing request checks Origin. Logout revokes the D1 session. Do not share Gmail password or tokens.

**Drive authorization is separate:** a backend-only refresh token scoped appropriately for the Drive owner. Login does **not** grant the browser Drive permissions. Existing manually uploaded Drive files may need explicit app authorization beyond `drive.file`; only use an approved least-privilege scope. The browser receives only site-managed `/api/media/:id/stream` and `/cover` URLs. Drive isn't a CDN; test real HTTP Range/206, quotas, throttling, and mobile seeking before publishing real songs.

## Production integration is NOT activated

Before selecting `VITE_MEDIA_SOURCE=google-drive`, with owner approval:

1. Create/configure a Google Cloud OAuth web client and enable Drive API. Callback **exactly** `https://hanipham.quainhon.com/api/auth/google/callback` once the domain is active. For other domains, set `SITE_ORIGIN` and the matching registered callback accordingly. Google consent-screen/testing/verification may apply.
2. Set **server-only** bindings: `SITE_ORIGIN`, `OWNER_GOOGLE_EMAIL`, optionally `OWNER_GOOGLE_SUB`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, separate `DRIVE_REFRESH_TOKEN`, and approved folder IDs (`DRIVE_SONGS_FOLDER_ID`, `DRIVE_PHOTOS_FOLDER_ID`, `DRIVE_COVERS_FOLDER_ID`). Do not put secrets in `.env`, `VITE_*`, source code or GitHub. `.env.example` lists placeholders only.
3. Create a new, dedicated D1 instance after confirming account/environment; bind it as `DB` in `wrangler.json` (template: `wrangler.d1.example.json`). Test `migrations/0001_init.sql` locally first. **Never run remote migrations without explicitly checking and approving the target.**
4. Run real OAuth/Drive/D1/streaming integration tests in a dev environment. Only then build frontend with `VITE_MEDIA_SOURCE=google-drive`. Bad source values throw an error instead of silently falling back to demo.

No external state is changed by unpacking/running the mock site. The `wrangler.json` supplied here has no D1 ID or secrets on purpose.

## API contract

Anonymous: `GET /api/media`, `/api/media/:id`, `/api/media/latest`, `/api/media/popular`, `/api/media/search?q=`, `/api/media/:id/stream`, `/api/media/:id/cover`, `/api/tributes`.

Owner auth: `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `GET /api/admin/session`, `POST /api/admin/logout`.

Owner content: `GET /api/admin/media`, `PATCH /api/admin/media/:id`, `DELETE /api/admin/media/:id` (soft archive), `POST /api/admin/upload/song`, `POST /api/admin/upload/photo`, `POST /api/admin/import`.

D1 stores metadata/state/counts/session hashes; Drive stores original files. Public media projections never return Drive IDs, tokens or admin data. Only published, non-archived items appear to anonymous visitors. Aggregate favorites/counts are stored fields, but cross-visitor mutations/counting are NOT implemented. Payment integration is NOT implemented; payment URL is optional and tributes require both payment verification and approval before public display.

### Import existing Drive files

The owner may upload via the website once connected, OR place existing audio, photo or cover files in the **configured Drive folders** and explicitly index their IDs. `POST /api/admin/import` requires the owner session and same-origin request, validates existing Drive files' actual MIME/size/approved parent folder via Drive API, and stores only metadata in D1 (does not copy or delete files). Example request, after replacing fake IDs, with a valid owner session:

```json
{
  "type": "song",
  "title": "Tên bài hát",
  "artist": "Hani Pham",
  "caption": "Một dòng ghi chú",
  "tags": [],
  "mood": [],
  "isPublished": false,
  "driveFileId": "EXISTING_AUDIO_FILE_ID",
  "coverDriveFileId": "EXISTING_COVER_FILE_ID"
}
```

For a photo set `type=photo`, pass its `driveFileId` and omit `coverDriveFileId`. Import is backend-only for now: no Drive browser or manual-ID form has been added to the approved UI. If `drive.file` cannot see an existing file, authorize the app for that file; do not make it public to bypass access control.

### Upload bounds

Browser & Worker: audio ≤24 MiB, image ≤8 MiB, supported MP3/WAV/OGG/M4A and JPG/PNG/WebP with backend signature check. Multipart requires a valid Content-Length ≤34 MiB (requests without it fail closed before buffering). Uploads above these limits need a separately engineered resumable client-to-backend workflow. If Drive succeeds but D1 fails, the backend reports a reconciliation error and keeps Drive files for manual inspection; it does not silently delete cloud content. A real Google upload, migration, email identity, and mobile audio streaming **have not been exercised** in this artifact.

## Architecture & testing

- `src/`: supplied UI/themes, audio state, typed API adapters. Demo mode simulates owner access; live mode redirects to Google.
- `server/auth.ts`, `http.ts`: OAuth/session and request guards.
- `server/routes/admin.ts`, `media.ts`: owner CRUD/import/upload and published public reads.
- `server/drive/files.ts`: Drive token, upload, approved-folder inspection and Range proxy.
- `server/repository.ts`, `migrations/`: D1 metadata projection/schema.
- `tests/core.test.ts`, `tests/google-auth.test.ts`, `tests/browser.mjs`, `tests/themes.mjs`: automated checks, **rerun locally**.

This build environment has no complete npm dependency cache or package-registry access: `npm ci --offline` could not install one missing package, so the frontend build, Vitest and browser tests could not be rerun here. Backend strict `tsc -p tsconfig.backend-check.json` did pass. Don't deploy before `npm ci && npm run check:backend && npm run build && npm test` all pass in Codespaces. Browser scripts require Vite running on port 5173 and Edge browser availability. No files were pushed to GitHub or deployed.
