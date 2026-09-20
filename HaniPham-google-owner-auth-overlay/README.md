# Hani Pham — refined UI + owner-auth backend

Local-first React/Vite frontend and Cloudflare Worker backend. **This archive is an overlay for `hani-pham-refined.zip`: extract the original into a new empty folder and then extract this overlay onto that folder.** Original images and local font assets are preserved from the original archive; they are not copied into this overlay. The approved portrait/UI and postcard basket are preserved. **No real account has been connected; no D1 database, Drive file, repository, or deployment has been modified.**

## Local UI

Requires Node 22+ and npm:

```sh
npm ci
npm run dev
```

Default `VITE_MEDIA_SOURCE=mock`: public UI, interactive basket, demo sign-in, simulated upload, in-memory drafts/management and player. Demo sign-in **does not use real Google identity**; uploaded media disappears on refresh. To build: `npm run build`. To test: `npm test`; then `node tests/browser.mjs` while Vite is running. Browser screenshots/previous results in the original ZIP predate the auth change: `tests/browser-results.json` in this ZIP explicitly marks tests **not rerun**.

No real Hani music or original portrait photo was provided. The portrait is a cropped section of the approved design reference, not an independently verified authentic portrait file. Demo photos/track names/tributes are illustrative.

## Owner Google sign-in — NOT Google Drive visitor sign-in

Visitors browse and listen anonymously. Only the owner clicks **Tải lên → Đăng nhập bằng Google**. The browser is redirected to the Google OAuth authorization-code flow with **openid email profile** (state, PKCE S256 and HTTPS callback). The server exchanges the code, checks Google's `email_verified` result, matches the exact allowlisted `OWNER_GOOGLE_EMAIL`, and optionally matches `OWNER_GOOGLE_SUB` (Google's stable user ID). An opaque hashed session is stored in D1 and an 8-hour HttpOnly, Secure, SameSite=Strict cookie is issued. Every owner API request checks the server session; mutating requests additionally check `Origin`. Logout removes the D1 session and expires the cookie. No frontend key, Gmail password, Google token or Drive credential is stored in Vite variables/localStorage.

**Google sign-in does not automatically grant Drive access.** A separate, backend-only `DRIVE_REFRESH_TOKEN` must be authorized by the Drive owner, with a suitable Drive scope. `drive.file` is preferable for files created or granted to this app; accessing arbitrary existing files generally requires additional authorization/scopes. Google may impose consent-screen/testing/verification requirements. Never share any refresh token, OAuth secret or owner account password in chat or commit them. The backend uses the refresh token to access Drive; the browser receives only site-managed media URLs.

## Configuration — not activated here

1. Identify the **one** authorized Google email and optionally its stable `sub`. Configure as server-only `OWNER_GOOGLE_EMAIL`, `OWNER_GOOGLE_SUB`. No email is hardcoded.
2. Create/configure a Google Cloud OAuth web client; enable Google Drive API. Register the **exact** redirect URI, e.g. `https://hani.quainhon.com/api/auth/google/callback`. Set server-only `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SITE_ORIGIN` (exact origin, no trailing slash). The OAuth callback intentionally requires HTTPS; test real OAuth on a controlled HTTPS dev origin, not plain Vite localhost.
3. Separately authorize a Drive refresh token for the intended Drive account and scope. Configure `DRIVE_REFRESH_TOKEN` plus `DRIVE_SONGS_FOLDER_ID`, `DRIVE_PHOTOS_FOLDER_ID`, `DRIVE_COVERS_FOLDER_ID` as server bindings/secrets. These are *not* VITE_* values. Do not use public sharing links as media URLs.
4. **Only with the owner's approval:** create a D1 database and bind it as `DB`. `wrangler.d1.example.json` is a template; copy its D1 binding into `wrangler.json` using your real database ID. `migrations/0001_init.sql` has **not** been run; test it on a new local/dev D1 first. Verify target environment before migrating anything. The supplied `wrangler.json` is intentionally unchanged and has no real database ID.
5. Only after testing the backend/API in your own dev environment, set `VITE_MEDIA_SOURCE=google-drive` in the frontend build. Unknown mode values now fail visibly rather than falling back to demo.

## Backend architecture

```text
server/worker.ts           route entrypoint, error handling and approved tributes
server/auth.ts             Google owner OAuth, state/PKCE, allowlist, D1 session
server/http.ts             HTTP guardrails/cookies/hashing
server/routes/media.ts     anonymous published catalog, image/audio streaming
server/routes/admin.ts     authenticated song/photo upload, drafts, edit/hide/archive
server/drive/files.ts      Drive refresh token, resumable upload, Range proxy
server/repository.ts       D1 metadata repository and public projection
server/types.ts            D1/Worker contracts
migrations/0001_init.sql  D1 schema; not applied
```

Public APIs: `GET /api/media`, `/api/media/:id`, `/api/media/latest`, `/api/media/popular`, `/api/media/search?q=`, `/api/media/:id/stream`, `/api/media/:id/cover`, `/api/tributes`.

Owner APIs: `GET /api/auth/google/start` (redirect), `GET /api/auth/google/callback`, `GET /api/admin/session`, `POST /api/admin/logout`, `GET /api/admin/media` (including drafts), `PATCH /api/admin/media/:id` (allowed fields only), `DELETE /api/admin/media/:id` (soft-archive in D1; **Drive file preserved**), `POST /api/admin/upload/song`, `POST /api/admin/upload/photo`. Unauthorized admin requests return 401 or fail closed; unconfigured services return 503. Only published, non-archived records are visible to anonymous visitors. Drive IDs and private session data never appear in public media JSON.

D1 stores *metadata only*; Google Drive stores original audio/photos/covers. No Supabase storage or R2 required. Metadata includes stable ID, Drive IDs, caption/tags/mood, date, publication state and counters. Popular sorting uses recorded aggregate counters; real cross-visitor counting/favorite writes are still deferred. Donation is intentionally a hosted-link/verified-tribute integration point, **not** an invented payment system.

### Upload and streaming limitations

The backend validates file type, maximum size and basic file signatures before Drive upload. Audio ≤24 MiB; image ≤8 MiB; whole multipart request ≤34 MiB when `Content-Length` is available. These bounds are deliberately lower than the old UI's 50/10 MB to limit Worker memory pressure; large WAV/master files need an independently audited streaming/resumable client upload path. For partial Drive uploads or a Drive-success/D1-failure, the backend returns a clear error and preserves files for manual reconciliation (no automatic deletion). There is **no** automatic cleanup job yet. Real uploads were not exercised.

Audio is proxied server-side and forwards Range to Drive; real 206, throttling (429), content type and mobile seeking **must be verified with the intended Drive account**. Drive isn't a CDN; bandwidth and playback availability aren't guaranteed. Backend OAuth/Drive access uses network calls only after server secrets are installed, never during ordinary demo browsing.

## Verification in this build environment

- Backend TypeScript strict compile via `tsc -p tsconfig.backend-check.json`: passed.
- TypeScript/TSX syntax transpilation of 18 source/test files: passed.
- Backend smoke tests using locally compiled server code, without Google/D1/Drive credentials: passed for unauthorized read/write, fail-closed catalog, unauthenticated session, public response not exposing Drive IDs. Google owner-auth mock flow also passed for denied non-owner, accepted allowlisted owner, and logout revocation.
- Full `npm ci` could not complete due unavailable package-registry access in this environment; therefore Vite build, Vitest, Playwright and real OAuth/Drive/D1 integration tests were **not rerun**. Run them locally before deployment.

No external/cloud state has been changed. The original refined ZIP remains untouched.
