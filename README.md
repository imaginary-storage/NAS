# Imaginary Storage (NAS)

> A self-hosted cloud storage platform that puts you in control. Access, manage, and share your files from anywhere — no subscriptions, no third parties, no limits.

<div align="center">

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![C](https://img.shields.io/badge/C-99-blue.svg)](https://en.wikipedia.org/wiki/C99)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6.svg)](https://www.typescriptlang.org/)

</div>

Imagine having your own personal Google Drive — no data leaving your server, no monthly fees, no privacy concerns. That's what Imaginary Storage gives you. It's a complete file management solution that runs on your own Linux machine, accessible through a sleek web dashboard that feels just like the cloud services you're used to.

Whether you're managing files on a home NAS, sharing projects with teammates, or building a backup system, Imaginary Storage handles it all — uploads, downloads, file previews, trash management, user accounts, disk mounting, and even AWS archival — all wrapped in a fast, modern interface.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Build & Run](#build--run)
- [API Reference](#api-reference)
  - [Authentication](#authentication)
  - [Session Management](#session-management)
  - [File System](#file-system)
  - [Chunked Resumable Upload](#chunked-resumable-upload)
  - [Trash](#trash)
  - [Admin (Root Only)](#admin-root-only)
  - [AWS Sync](#aws-sync)
  - [File Sharing](#file-sharing-posix-acls)
- [Security Model](#security-model)
- [User Data Directory](#imaginary-directory-layout-per-user)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Background Threads](#background-threads)
- [Frontend Architecture Notes](#frontend-architecture-notes)
- [License](#license)

---

## Features

- **🔒 Secure by Design** — every user operates in their own isolated environment. When you log in, the server runs your requests as *you* — using your actual Linux user account. No shared processes, no permission hacks.
- **🌐 Web Dashboard** — a fast, modern interface that works in any browser. Grid or list view, dark mode, drag-and-drop uploads, right-click menus, keyboard shortcuts — everything you'd expect from a cloud storage app.
- **📤 Resumable Uploads** — uploading large files over unstable connections? No problem. Files are split into chunks, verified with SHA-256 hashes, and automatically resumed from where they left off.
- **↔️ File Sharing** — share files and folders with other system users. Set read-only or read-write permissions, add expiration dates, and revoke access anytime.
- **🗑️ Trash System** — accidentally deleted something? Every delete moves files to a trash folder with full metadata. Restore in one click, or empty the trash when you're sure.
- **☁️ AWS Backup** — automatically archive folders to Amazon S3 Glacier or Deep Archive. Set it and forget it — the built-in scheduler handles the rest.
- **🖥️ Admin Panel** — manage Linux users (create, edit, delete) and physical disks (mount, unmount, format) right from the web interface. No SSH required.
- **⚡ Performance Built In** — a lightweight C server handles the heavy lifting. Small memory footprint, fast response times, no bloated frameworks on the backend.

---

## Architecture

### Backend

- **HTTP Framework:** Custom minimalist `chttp` framework (`lib/chttp.c` / `lib/chttp.h`)
- **Language:** C99 (compiled with GCC, `-Wall -Wextra`)
- **Entry Point:** `src/main.c` — route registration, auth wrappers, background scheduler init
- **Dependencies:** `libpam` (authentication), `libacl` (file sharing ACLs), `pthreads` (background schedulers)
- **Vendored:** `cJSON` (JSON parsing/generation), `sha256` (chunked upload verification)

#### Process Model

1. Server starts as `root`, creates `./sessions/` (mode 0700).
2. Route handlers are wrapped with `DEFINE_AUTH_ROUTE`, `DEFINE_STREAM_AUTH_ROUTE`, or `DEFINE_NOPRIV_AUTH_ROUTE`.
3. Auth wrappers validate the `active_session` cookie (token + username cross-check).
4. `DEFINE_AUTH_ROUTE` / `DEFINE_STREAM_AUTH_ROUTE`: call `fork_and_run()` / `fork_and_stream()` — fork child, `setuid`/`setgid` to the user, `chdir` to home, run handler, write response, `_exit()`. The parent waits with a timeout (30s / 1h) and reaps the child.
5. `DEFINE_NOPRIV_AUTH_ROUTE`: runs handler directly in the connection thread (as root) — used for session management and control-plane operations that need to write root-owned files.

#### Route Registration

Routes are registered in `src/main.c` via convenience macros:
```c
CHTTP_GET(&srv, "/path", handler)
CHTTP_POST(&srv, "/path", handler)
CHTTP_PUT(&srv, "/path", handler)
CHTTP_DELETE(&srv, "/path", handler)
CHTTP_STREAM_GET(&srv, "/path", handler)   // 1-hour timeout
CHTTP_STREAM_POST(&srv, "/path", handler)  // 1-hour timeout
CHTTP_HEAD(&srv, "/path", handler)
```

Source files in `src/`, `lib/`, and `vendor/` are auto-discovered by the Makefile.

### Frontend

- **Framework:** React 19, TypeScript, Vite 8
- **Styling:** Tailwind CSS v4 + `tw-animate-css` + shadcn/ui (base-nova style)
- **State:** Redux Toolkit (11 slices)
- **Routing:** React Router v7
- **Icons:** Lucide React, material-icon-theme (file type icons)
- **Dark Mode:** next-themes (`attribute="class"`, persisted to localStorage)
- **Toasts:** Sonner
- **Fonts:** Plus Jakarta Sans (Google Fonts), JetBrains Mono (monospace)
- **Build Output:** `frontend/` → `../www/` (served by the backend as static files)
- **File Viewer:** Viewer page at `/view` detects file type (`image`, `video`, `audio`, `pdf`, `text`) by MIME + extension using `lib/fileTypes.ts`
- **File Icons:** `material-icon-theme` mapping in `components/files/fileIcons.ts` — maps file extensions to Material Design icons
- **Utils:** `cn()` utility via `clsx` + `tailwind-merge`

---

## Project Structure

```
├── lib/                    # Custom C HTTP framework (chttp.c / chttp.h)
├── vendor/                 # Vendored libraries (cJSON, SHA-256) — do not modify
├── src/
│   ├── main.c              # Entry point, route registration, auth wrappers
│   ├── auth/               # PAM authentication, session management, fork_and_run
│   │   ├── auth.h          # Auth macros (DEFINE_AUTH_ROUTE, etc.)
│   │   ├── auth.c          # authenticate_pam(), fork_and_run(), fork_and_stream()
│   │   └── session.c       # Session create/validate/delete/parse, atomic writes
│   ├── routes/
│   │   ├── routes.c/.h     # Login, whoami, legacy test routes
│   │   ├── session_mgmt.c  # GET/DELETE /sessions, POST /sessions/switch, logout
│   │   └── static.c/.h     # Static file server (Range, ETag, SPA fallback)
│   ├── fs/
│   │   ├── fs.c/.h         # All /fs/* handlers (list, upload, download, mkdir,
│   │   │                     rename, move, copy, stat, content read/write,
│   │   │                     streaming upload, chunked resumable upload)
│   │   └── trash.c/.h      # Trash system (move-to-trash, restore, delete, empty)
│   ├── admin/
│   │   ├── admin.c/.h      # User CRUD (via useradd/usermod/userdel/chpasswd)
│   │   └── disk.c          # Disk list/mount/unmount/format (via lsblk/mount/umount/mkfs)
│   ├── share/
│   │   ├── share.c/.h      # File sharing via POSIX ACLs (registry, apply, revoke)
│   │   └── sweeper.c       # Periodic expired-share cleanup thread
│   ├── aws_sync/
│   │   ├── aws_sync.h      # AWS S3/Glacier sync API + scheduler interface
│   │   ├── config.c        # Config CRUD, manual sync trigger (pthread worker)
│   │   └── scheduler.c     # Background scheduler (scans /home every 60s)
│   └── utils/
│       ├── utils.c/.h      # mime_from_ext, safe_path, safe_filename, fs_error,
│                              parse_multipart
├── frontend/               # React SPA
│   └── src/
│       ├── main.tsx        # Provider, ThemeProvider, Toaster, TooltipProvider
│       ├── App.tsx         # Router, ProtectedRoute, route definitions
│       ├── index.css       # Tailwind v4 + CSS variables (light/dark theme)
│       ├── types/api.ts    # TypeScript API response types
│       ├── api/            # API client modules (client, auth, filesystem, trash,
│       │                     sessions, admin, awsSync, share)
│       ├── store/
│       │   ├── index.ts    # configureStore (11 reducers)
│       │   ├── hooks.ts    # Typed dispatch/selector hooks
│       │   └── slices/     # auth, fileSystem, uploads, trash, sessions,
│       │                     bookmarks, settings, users, disks, awsSync, shares
│       ├── lib/            # uploadEngine, fileTypes, utils (cn)
│       ├── components/
│       │   ├── layout/     # AppShell, TopBar, Sidebar
│       │   ├── files/      # FileBrowser, FileGrid, FileList, FileCard, FileRow,
│       │   │                 Breadcrumbs, PlacesPanel, Toolbar, FilePreview,
│       │   │                 FileContextMenu, DeleteConfirmDialog, FileIcon,
│       │   │                 fileIcons, DownloadDialog, NewFolderDialog, RenameDialog
│       │   ├── uploads/    # UploadManager
│       │   ├── auth/       # LoginForm
│       │   ├── sessions/   # SessionList, SessionCard
│       │   ├── admin/      # UserList/Dialog/Card, DiskList/Card, Mount/Format Dialog
│       │   ├── share/      # ShareDialog
│       │   ├── settings/   # AwsSyncCard, FolderPickerDialog, ManageSharesCard
│       │   └── ui/         # 15 shadcn/ui primitives (button, dialog, tooltip, etc.)
│       └── pages/          # LoginPage, DashboardPage, SettingsPage,
│                             FileViewerPage, UsersPage, DisksPage
├── landing/                # Separate landing page (Vite + React + Tailwind)
├── scripts/                # Shell test scripts (17 scripts, one per endpoint + runner)
├── poc/                    # Proof-of-concept HTML for resumable upload testing
├── journal/                # Implementation plans and notes
├── prompts/                # Session prompts for AI-assisted development
├── build/                  # Intermediate build artifacts (.o / .d) — gitignored
├── dist/                   # Compiled server binary — gitignored
├── www/                    # Frontend build output — gitignored
├── sessions/               # Session files (created at runtime) — gitignored
├── uploads/                # Legacy upload fixture — gitignored
├── .github/workflows/      # GitHub Actions CI/CD
├── Makefile                # Backend build system
└── run                     # Build + run script (make + frontend build + sudo)
```

---

## Getting Started

### Prerequisites

- **OS:** Linux (required for PAM, `setuid`, POSIX ACLs, `mount`/`umount`/`mkfs`)
- **Compiler:** GCC with `make`
- **System Dependencies:** `libpam-dev`, `libacl1-dev`, `pthreads`
- **Node.js:** v20+ (for frontend)
- **Runtime Dependencies:** `sudo` (server runs as root), `aws-cli` (for S3 sync)

### Build & Run

**Backend:**
```bash
make              # compiles dist/server (zero-warning build)
make clean        # removes build/ and dist/
```

**Frontend (development):**
```bash
cd frontend
npm install
npm run dev       # Vite dev server on :5173, proxies API to :8080
npx tsc --noEmit  # type-check only
```

**Frontend (production):**
```bash
cd frontend
npm run build     # vite build → ../www/
```

**Run the server:**
```bash
./run             # builds everything and starts with sudo
                  # or: sudo ./dist/server
```

The server listens on port **8080** by default.

The `./run` script: builds the server (`make`), builds the frontend (`cd frontend && npm run build`), then starts with `sudo ./dist/server`.

The `.envrc` file (for `direnv`) adds `$PWD` and `$PWD/scripts` to `PATH`, and sources a `.env` file if present.

---

## API Reference

All authenticated endpoints (except `/login`) require the `active_session` cookie set by a successful login.

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/login` | PAM authentication, sets `session_<user>=<token>` and `active_session=<token>/<user>` cookies |
| `GET` | `/whoami` | Returns `{uid, gid, username, home, shell, cwd}` — runs in forked user context |
| `DELETE` | `/logout` | Deletes active session, clears all session cookies |

### Session Management

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/sessions` | Lists all sessions found in cookies |
| `DELETE` | `/sessions/:session_id` | Deletes a specific session (owns via `session_<user>=<token>` cookie) |
| `POST` | `/sessions/switch/:session_id` | Switches `active_session` to a different existing session |

### File System

All paths are relative to the authenticated user's home directory (`chdir` to home after privilege drop).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/fs/list?path=.` | List directory entries (`name`, `type`, `size`, `modified`, `mime`) |
| `POST` | `/fs/upload?path=.` | Simple multipart file upload |
| `GET` | `/fs/download?path=...` | Download file (STREAM route, supports `?inline=1`) |
| `DELETE` | `/fs/file?path=...` | **Moves to trash** (soft delete) |
| `POST` | `/fs/mkdir` | `mkdir -p`, body: `{"path":"..."}` |
| `DELETE` | `/fs/dir?path=...` | **Moves to trash** (soft delete) |
| `POST` | `/fs/rename` | Body: `{"path":"...","name":"..."}` |
| `POST` | `/fs/move` | Body: `{"from":"...","to":"..."}` |
| `POST` | `/fs/copy` | Body: `{"from":"...","to":"..."}` |
| `GET` | `/fs/stat?path=...` | File/directory metadata (`name`, `type`, `size`, `mode`, `uid`, `modified`, `mime`) |
| `GET` | `/fs/content?path=...` | Read text file (≤64 KB), returns `{"path","content"}` |
| `PUT` | `/fs/content?path=...` | Write text file body as raw text |
| `POST` | `/fs/upload-stream?path=...` | Streaming upload requiring `Content-Length` (STREAM route) |

### Chunked Resumable Upload

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/fs/upload-session` | Create upload session from JSON manifest → `{upload_id}` |
| `GET` | `/fs/upload-session/:upload_id` | Query session status → `{received_chunks[]}` |
| `STREAM_POST` | `/fs/upload-chunk/:upload_id` | Upload one chunk with `X-Chunk-Index` header (STREAM route) |
| `DELETE` | `/fs/upload-session/:upload_id` | Abort and clean up |

Manifest fields: `dest`, `filename`, `file_size`, `chunk_size`, `chunk_count`, `chunk_hashes[]` (SHA-256 hex).
Temp storage: `~/.imaginary/uploads/<id>.meta` / `.state` / `.data`.
On completion: `rename(.data, dest)`, cleanup `.meta` / `.state`.

### Trash

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/trash/list` | List trashed items |
| `POST` | `/trash/restore` | Body: `{"name":"..."}` — restore to original path |
| `DELETE` | `/trash/:name` | Permanently delete one trashed item |
| `DELETE` | `/trash` | Empty entire trash |

Trash storage: `~/.imaginary/trash/files/<name>` + `~/.imaginary/trash/info/<name>.info`
Info format: `path=<original>\ndeleted_at=<ISO8601>\n`
Name collisions append `.1`, `.2`, etc.

### Admin (Root Only)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/users` | List all system users (uid ≥ 1000 + root) |
| `POST` | `/admin/users` | Create user (`useradd -m`, `chpasswd`) |
| `PUT` | `/admin/users/:username` | Edit user (shell, groups, password via `usermod`/`chpasswd`) |
| `DELETE` | `/admin/users/:username` | Delete user (`userdel -r`) |
| `GET` | `/admin/disks` | List block devices (`lsblk -Jbo`) |
| `POST` | `/admin/disks/mount` | Mount device — body: `{device, mountpoint, fstype?}` |
| `POST` | `/admin/disks/unmount` | Unmount — body: `{mountpoint}` |
| `POST` | `/admin/disks/format` | Format — body: `{device, fstype}` (runs `mkfs.<fstype>`) |

### AWS Sync

Per-user write-only archival to S3 Glacier/DEEP_ARCHIVE. Config stored at `~/.imaginary/config/aws-sync.json`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/aws-sync` | Get current user's config (credentials redacted) |
| `PUT` | `/aws-sync` | Save/update config — body: `{enabled, folder, bucket, prefix, region, accessKeyId, secretAccessKey, storageClass, intervalMinutes}` |
| `DELETE` | `/aws-sync` | Delete config |
| `POST` | `/aws-sync/run` | Trigger immediate sync (spawns detached pthread, returns 202) |

The background scheduler (`aws_sync_scheduler_start`) scans `/home/*/.imaginary/config/aws-sync.json` every 60s and runs `aws s3 sync` for enabled, due configs.

### File Sharing (POSIX ACLs)

Shares are registered in a root-owned registry at `/var/lib/imaginary/shares.json`. Access is enforced by POSIX ACL entries on the shared paths. Recipient access requires a valid share ID — the ACL still provides the kernel-level gate.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/share` | Create share — body: `{source, recipient, kind, mode, expires_at?}` |
| `DELETE` | `/share/:share_id` | Revoke share (removes ACLs) |
| `GET` | `/share/incoming` | List shares received by the caller |
| `GET` | `/share/outgoing` | List shares created by the caller |
| `GET` | `/share/users` | List sharable system users (uid ≥ 1000, excluding self) |
| `GET` | `/share/:share_id/list?path=.` | List directory in shared path |
| `GET` | `/share/:share_id/stat?path=.` | Stat file in shared path |
| `GET` | `/share/:share_id/content?path=.` | Read text file in shared path (≤64 KB) |
| `PUT` | `/share/:share_id/content?path=.` | Write text file in shared path (rw only) |
| `POST` | `/share/:share_id/mkdir` | Create directory in shared path (rw only) |
| `DELETE` | `/share/:share_id/file?path=.` | Delete file in shared path (rw only) |
| `STREAM_GET` | `/share/:share_id/download?path=.` | Download from shared path (STREAM) |
| `STREAM_POST` | `/share/:share_id/upload?path=.` | Upload to shared path (STREAM, rw only) |

The share sweeper thread (`share_sweeper_start`) checks every 60s for expired shares, revokes them, and garbage-collects entries revoked >30 days.

---

## Security Model

- **Authentication:** System PAM. Any local Linux user can log in with their system password.
- **Sessions:** Token-based, stored in `./sessions/session_<hex64>`, root-owned (mode 0644). Tokens are 64 random hex bytes from `/dev/urandom`. Session files use atomic rename-based writes to prevent partial reads.
- **Privilege Drop:** Each authenticated request forks; the child calls `initgroups()`, `setgid()`, `setuid()` to become the user. The child verifies the drop is irreversible (attempts `setuid(0)`, must fail for non-root users). The parent waits with a timeout and kills hung children.
- **Path Safety:** `safe_path()` rejects `..` traversal. `safe_filename()` rejects `/`, `\`, and `..`. All FS and share paths are validated.
- **File Permissions:** No application-level permission simulation — the kernel enforces standard `rwx` and ACL permissions based on the forked child's UID/GID.
- **Sharing:** POSIX ACLs applied via `libacl`. Parent-directory `--x` traversal ACLs are added for shared paths. The share registry in `/var/lib/imaginary/` is root-owned and read-only by all.

---

## `~/.imaginary/` Directory Layout (Per-User)

```
~/.imaginary/
├── places                    # Bookmarks file (tab-separated: path\tlabel)
├── config/
│   ├── settings.json         # Frontend settings (viewMode, iconSize)
│   └── aws-sync.json         # AWS sync configuration (mode 0600)
├── trash/
│   ├── files/                # Trashed files/directories (flat, collision-suffixed)
│   └── info/                 # Sidecar .info files (path + deleted_at)
└── uploads/                  # Chunked upload temp storage (<id>.meta/.state/.data)
```

---

## Testing

```bash
# Integration test suite (requires running server + valid user)
./scripts/runtests.sh <username> <password>
```

Individual endpoint test scripts are in `scripts/` (e.g., `login.sh`, `fslist.sh`, `fstest.sh`).

---

---

## CI/CD

| Workflow | Trigger | Action |
|----------|---------|--------|
| `landing-pages.yml` | Push to `main` touching `landing/**` or workflow file | Builds `landing/` with Vite, deploys to GitHub Pages via `actions/deploy-pages@v4` |

The landing page is configured for a custom domain (`public/CNAME`). Build base is `/`.

---

## Background Threads

| Thread | Purpose | Interval |
|--------|---------|----------|
| `aws_sync_scheduler` | Runs `aws s3 sync` per user config | 60s tick |
| `share_sweeper` | Revokes expired shares, GCs old entries | 60s tick |

---

## Frontend Architecture Notes

- **Navigation:** `navigateTo(path)` calls `listDirThunk(path).unwrap()`, only updates URL on success. Prevents path spam from key-repeat.
- **Trash View:** Pseudo-path `trash:///` renders the trash interface instead of a real filesystem path.
- **Upload Engine:** Singleton (`uploadEngine` in `lib/uploadEngine.ts`) — sequential queue, one file at a time. 4 MB chunks, SHA-256 hashing via SubtleCrypto, exponential-backoff retry (max 10). Resume via `localStorage` (checks `/fs/upload-session/:id` for `received_chunks`). `onChange`/`onComplete` events. Pause/resume via `togglePause()` (50ms poll). Per-item `AbortController` for cancellation.
- **Settings Persistence:** Debounced save (500ms) via `/fs/content` API.
- **Session Switch:** `suppress401Redirect()` temporarily disables the 401→login redirect during the race window.
- **401 Handling:** `api/client.ts` dispatches `auth:unauthorized` window event → `ProtectedRoute` listens → navigates to `/login`.
- **Vite Proxy:** Dev server proxies `/login`, `/logout`, `/whoami`, `/sessions`, `/fs`, `/trash`, `/admin`, `/static` to `http://localhost:8080`.

---

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for more information.

---

## Acknowledgments

- Built as the BTech (IT) final year major project at [Your University Name]
- Thanks to our project supervisor and everyone who contributed
