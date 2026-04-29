# Imaginary Storage — NAS Dashboard

Self-hosted NAS file manager with a C HTTP server backend (the `chttp` framework) and React frontend.

## Build & Run

```bash
make              # builds dist/server (zero-warning required)
make TLS=1        # HTTPS support (links -lssl -lcrypto)
make clean        # removes build/ and dist/
./run server      # builds + starts with sudo
```

Frontend:
```bash
cd frontend
npm install
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npx tsc --noEmit  # type-check only (use this, tsc -b has pre-existing strict errors)
```

## Project Layout

```
vendor/           cJSON.c/h (never modify), sha256.c/h
lib/              chttp.c / chttp.h  (HTTP framework)
src/
  main.c          entry point, route registration, DEFINE_AUTH_ROUTE macros
  auth/           auth.h  session.c  auth.c  (PAM, sessions, fork_and_run)
  fs/             fs.h  fs.c  (all /fs/* handlers)
                  trash.h  trash.c  (trash system — move-to-trash, restore, delete, empty)
  routes/         routes.h routes.c (login, whoami)
                  session_mgmt.c (session CRUD, switch)
                  static.c (static file serving)
  admin/          admin.h admin.c disk.c (user/disk management, root-only)
  utils/          utils.h utils.c (mime_from_ext, safe_path, safe_filename, fs_error, parse_multipart)
build/            .o / .d files (gitignored)
dist/             compiled binary (gitignored)
frontend/         React app (Vite + TypeScript + Tailwind v4 + Redux Toolkit)
poc/              proof-of-concept HTML files (e.g., multi-upload.html for resumable uploads)
journal/          implementation plans and notes
```

## Backend Architecture

### Server Process Model
- Server runs as root (`sudo`), creates `sessions/` dir with mode 0700
- No privilege separation in the server process itself (no monitor/worker split currently)
- `DEFINE_AUTH_ROUTE(wrapper, impl)` — validates `active_session` cookie, then `fork_and_run()` which forks, drops to the authenticated user (setuid/setgid), chdir to user's home, runs the handler, writes response, `_exit()`
- `DEFINE_STREAM_AUTH_ROUTE` — same but 1-hour timeout (for large uploads/downloads)
- `DEFINE_NOPRIV_AUTH_ROUTE` — validates cookie, runs handler directly (no fork) — for session management

### Route Registration (src/main.c)
- Routes registered via `CHTTP_GET/POST/DELETE/PUT/STREAM_GET/STREAM_POST(&srv, "/path", handler)`
- Auth wrappers declared at top of main.c before `main()`
- New `.c` files in `src/` are auto-discovered by Makefile (`find src/ lib/ vendor/ -name '*.c'`)

### Key Patterns
- Handler signature: `void fn(HttpRequest *req, HttpResponse *res)`
- JSON responses: `chttp_send_json(res, "...")` or `chttp_send_cjson(res, cJSON_obj)`
- Path params: `chttp_path_param(req, "name")`
- Query params: `chttp_query_param(req, "path")`
- Error mapping: `fs_error(res, errno)` — maps errno to HTTP status
- Path validation: `safe_path(path)` rejects `..`; `safe_filename(name)` rejects `/`, `\`, `..`

### Sessions
- Files in `./sessions/session_<hex64>`, mode 0644
- Cookie format: `active_session=<token>/<username>; HttpOnly; Path=/; SameSite=Lax`
- `create_session()` in `src/auth/session.c` — writes session file, returns session ID

## API Endpoints

### Auth
- `POST /login` — PAM auth, sets cookies
- `GET /whoami` — authenticated, returns uid/gid/username/home/shell/cwd
- `GET /sessions` — list sessions from cookies
- `DELETE /sessions/:session_id` — delete session
- `DELETE /logout` — delete active session
- `POST /sessions/switch/:session_id` — switch active session

### File System (all authenticated, paths relative to user home)
- `GET /fs/list?path=.` — list directory
- `POST /fs/upload?path=.` + multipart — simple upload
- `GET /fs/download?path=…` — download (STREAM)
- `DELETE /fs/file?path=…` — **moves to trash** (not hard delete)
- `POST /fs/mkdir` `{"path":"…"}` — mkdir -p
- `DELETE /fs/dir?path=…` — **moves to trash** (not hard delete)
- `POST /fs/rename` `{"path":"…","name":"…"}`
- `POST /fs/move` `{"from":"…","to":"…"}`
- `POST /fs/copy` `{"from":"…","to":"…"}`
- `GET /fs/stat?path=…` — file metadata
- `GET /fs/content?path=…` — read text file (≤64 KB)
- `PUT /fs/content?path=…` — write text file

### Trash (all authenticated)
- `GET /trash/list` — list trashed items
- `POST /trash/restore` `{"name":"…"}` — restore to original path
- `DELETE /trash/:name` — permanently delete one item
- `DELETE /trash` — empty entire trash

Trash storage: `~/.imaginary/trash/files/<name>` + `~/.imaginary/trash/info/<name>.info`
Info file format: `path=<original>\ndeleted_at=<ISO8601>\n`
Name collisions: appends `.1`, `.2`, etc.

### Chunked Resumable Upload (all authenticated)
- `POST /fs/upload-session` — create from JSON manifest → `{upload_id}`
- `GET /fs/upload-session/:upload_id` — query status → `{received_chunks[]}`
- `STREAM_POST /fs/upload-chunk/:upload_id` + `X-Chunk-Index` header — upload one chunk
- `DELETE /fs/upload-session/:upload_id` — abort

Manifest fields: `dest` (full path like `subdir/file.zip`), `filename`, `file_size`, `chunk_size` (4MB), `chunk_count`, `chunk_hashes[]` (SHA-256 hex).
Temp files in `~/.imaginary/uploads/<id>.meta/state/data`. On completion: `rename(.data, dest)`, delete `.meta`/`.state`.

### Admin (root-only, guarded by `getuid() != 0` check)
- `GET/POST /admin/users`, `PUT/DELETE /admin/users/:username`
- `GET /admin/disks`, `POST /admin/disks/mount|unmount|format`

## Frontend Architecture

### Stack
- React 19, TypeScript, Vite, Tailwind CSS v4 (inline @theme in index.css)
- Redux Toolkit (store at `frontend/src/store/`)
- React Router v7, shadcn/ui components, Lucide icons
- next-themes for dark mode (ThemeProvider in main.tsx, attribute="class")
- Sonner for toast notifications

### Key Files
```
src/
  main.tsx              — Provider, ThemeProvider, Toaster
  App.tsx               — Router, ProtectedRoute (auth check)
  api/
    client.ts           — apiRequest() wrapper, 401 handling, suppress401Redirect()
    filesystem.ts       — fs API functions
    trash.ts            — trash API functions
    sessions.ts         — session API functions
  store/
    index.ts            — configureStore with all reducers
    slices/
      fileSystemSlice.ts   — currentPath, entries, selection, clipboard
      uploadsSlice.ts      — upload items state (synced from uploadEngine)
      trashSlice.ts        — trash items
      bookmarksSlice.ts    — places/bookmarks (persisted to ~/.imaginary/places)
      settingsSlice.ts     — viewMode, iconSize (persisted to ~/.imaginary/config/settings.json)
      authSlice.ts         — user, login/logout
      sessionsSlice.ts     — session list, switch
  lib/
    uploadEngine.ts     — resumable upload engine (singleton, event-based)
    fileTypes.ts        — file type detection for viewer
    utils.ts            — cn() utility
  components/
    layout/
      AppShell.tsx      — TopBar + Sidebar + Outlet + UploadManager
      TopBar.tsx        — header with user dropdown
      Sidebar.tsx       — nav, places, sessions, theme toggle (Sun/Moon)
    files/
      FileBrowser.tsx   — main file explorer (orchestrates everything)
      Breadcrumbs.tsx   — address bar with edit mode, handles Home/Root/Trash display
      PlacesPanel.tsx   — sidebar places (Root, Home, Trash + user bookmarks)
      FileGrid.tsx      — grid view
      FileList.tsx      — list view
      FileCard.tsx      — single file in grid
      FileRow.tsx       — single file in list
      FileContextMenu.tsx — right-click menu (normal + trash mode)
      Toolbar.tsx       — search, sort, view mode, upload/delete buttons (+ trash mode)
      FilePreview.tsx   — properties dialog
      DeleteConfirmDialog.tsx — "Move to Trash" / "Delete Permanently" dialog
    uploads/
      UploadManager.tsx — Google Drive-style bottom-right widget (collapsible, pause/resume)
    auth/
      LoginForm.tsx
    sessions/
      SessionList.tsx, SessionCard.tsx
  pages/
    DashboardPage.tsx   — just renders FileBrowser
    LoginPage.tsx
    SettingsPage.tsx
    UsersPage.tsx, DisksPage.tsx
```

### Navigation Pattern
- `navigateTo(path)` is async: calls `listDirThunk(path).unwrap()`, only updates URL on success
- `currentPath` is set by `listDirThunk.fulfilled` from server response, NOT eagerly
- This prevents path spam from key-repeat or stale closures
- Pseudo-path `trash:///` for trash view (not a real FS path)

### Upload Engine (`src/lib/uploadEngine.ts`)
- Singleton `uploadEngine` — sequential queue, one file at a time
- Flow: hash all chunks (SHA-256) → create session → upload chunks with exponential-backoff retry → completion
- Resume: saves `{upload_id, chunk_hashes}` to localStorage, checks server for received chunks on retry
- `addFiles(files, dir)` — builds `dest` as `dir/filename` (or just `filename` when `dir === "."`)
- Events: `onChange(fn)` for progress updates, `onComplete(fn)` for completion
- Pause/resume: `togglePause()`, global flag with 50ms poll
- Abort: per-item AbortController, DELETEs server session

### Dark Mode
- CSS variables in `index.css`: `:root` (light) and `.dark` (dark)
- Dark palette: background `#0C0F1A`, card `#161B2E`, border `#1E2640`, muted text `#8892B0`
- Theme toggle in sidebar footer (Sun/Moon icons)
- next-themes handles `.dark` class on `<html>` and localStorage persistence
- All components use `dark:` Tailwind variants for hardcoded colors

### Settings Persistence
- `~/.imaginary/config/settings.json` — viewMode, iconSize (read/written via /fs/content API)
- `~/.imaginary/places` — bookmarks (tab-separated: `path\tlabel`)
- Debounced save (500ms) for settings changes

### Session Switch
- `suppress401Redirect()` in `api/client.ts` — temporarily suppresses 401→login redirect during session switch (cookie race condition)
- Sidebar `handleSwitch`: suppress401 → switchSessionThunk → setCurrentPath → navigate → await listDirThunk → fetchBookmarks + fetchSettings

### `.imaginary/` Directory (per-user, in home)
```
~/.imaginary/
  places              — bookmarks file (tab-separated path\tlabel)
  config/
    settings.json     — {viewMode, iconSize}
  trash/
    files/            — trashed files/dirs (flat, collision-suffixed)
    info/             — sidecar .info files (path + deleted_at)
  uploads/            — chunked upload temp files (<id>.meta/state/data)
```
