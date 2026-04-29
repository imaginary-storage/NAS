# File sharing between users — `feat/file-sharing`

## Context

Add per-user file/folder sharing on top of the existing fork+setuid handler
model. A user picks a target file or directory, a recipient (another OS user
known to PAM/`getpwnam`), an access mode (read-only, or read/write for
folders), and an expiry time. The sharer can revoke at any time.

The chttp framework already runs each authenticated request as the recipient's
UID, so **the cleanest enforcement primitive is POSIX ACLs** — the kernel
does the work for us. Both `setfacl/getfacl` and `libacl.so` are present.

This plan covers v1 only:
- File: read-only.
- Folder: read-only OR read/write.
- One recipient per share (multi-recipient is a follow-up — create N shares).
- No nested-share dedup logic; ACLs simply stack.
- Stale-on-rename: registry stores absolute paths; if the sharer renames the
  source, the share goes stale. v1 surfaces "stale" status and lets either
  side revoke. No inode tracking.

---

## Approach

### 1. Storage model

Single root-owned JSON file at `/var/lib/imaginary/shares.json`, mode `0644`
(world-readable so each user's per-user listing handler can read it; only root
writes it).

```jsonc
{
  "shares": [
    {
      "id": "sh_<32-hex>",
      "sharer": "alice",
      "recipient": "bob",
      "source_path": "/home/alice/Documents/report.pdf",
      "kind": "file" | "dir",
      "mode": "ro" | "rw",
      "created_at": 1730000000,
      "expires_at": 1730086400,        // 0 = never
      "revoked": false
    }
  ]
}
```

`/var/lib/imaginary/` is created in `main.c` at startup (mode `0755`,
root-owned). Atomic writes via the same `write_atomic` pattern as
`src/aws_sync/scheduler.c:50` (temp + fsync + rename, no `fchown` since this
file stays root-owned).

### 2. Access enforcement via POSIX ACLs

When a share is created (NOPRIV handler — see §4), apply ACLs:

| Kind | Mode | ACLs applied |
|------|------|--------------|
| file | ro   | `u:<recipient>:r--` on source |
| dir  | ro   | `u:<recipient>:r-x` recursive + default ACL |
| dir  | rw   | `u:<recipient>:rwx` recursive + default ACL |

Plus traversal `--x` ACLs on each parent directory up to `/` so the recipient
can resolve the path. Use **libacl** (link `-lacl`) directly rather than
shelling out — clean C API. Only `aws_sync` and `admin` shell out elsewhere
and both have strong reasons to.

**Revocation:** remove `u:<recipient>` ACL from source (recursive + default
for dirs). Parent-dir traversal `--x` ACLs are **not** removed on revoke —
they are harmless (`--x` alone leaks no listings) and may be needed by other
shares to the same recipient. Acceptable minor leak; documented.

### 3. Sharer privilege check (security-critical)

`POST /share` is **NOPRIV** (runs as root) so it can write the registry and
apply ACLs. Before doing anything:

1. Parse `active_session` cookie → sharer username.
2. `stat(source_path)` must succeed; sharer must own or have write access.
3. `getpwnam(recipient)` must succeed; reject system users (`uid < 1000`),
   reject self-share, reject `recipient == "root"`.
4. Reject `kind=file && mode=rw` (files are RO only — keep v1 simple).
5. Reject if a non-revoked share already exists for
   `(sharer, recipient, source_path)`. To update, DELETE then re-create.

This prevents a user from sharing files they don't own.

### 4. Endpoint surface

New module `src/share/share.c` + `src/share/share.h`:

| Method | Path | Macro | Purpose |
|--------|------|-------|---------|
| POST   | `/share`                          | NOPRIV       | Create share (registry + ACLs as root) |
| DELETE | `/share/:share_id`                | NOPRIV       | Revoke (sharer-only) |
| GET    | `/share/incoming`                 | AUTH         | List shares where `recipient == me` |
| GET    | `/share/outgoing`                 | AUTH         | List shares where `sharer == me` |
| GET    | `/share/users`                    | AUTH         | List recipient candidates (`uid >= 1000`, ≠ self) |
| GET    | `/share/:share_id/list?path=`     | AUTH         | Listing inside a share |
| GET    | `/share/:share_id/stat?path=`     | AUTH         | Stat |
| STREAM_GET  | `/share/:share_id/download?path=` | STREAM_AUTH | Download |
| GET    | `/share/:share_id/content?path=`  | AUTH         | Read text (≤64 KB) |
| PUT    | `/share/:share_id/content?path=`  | AUTH         | Write text (RW only) |
| STREAM_POST | `/share/:share_id/upload?path=` | STREAM_AUTH | Upload (RW only) |
| POST   | `/share/:share_id/mkdir`          | AUTH         | mkdir (RW only) |
| DELETE | `/share/:share_id/file?path=`     | AUTH         | Delete file (RW only) |

Data ops are **thin wrappers**:
1. Look up share in registry (recipient must match cookie user; not revoked;
   not expired).
2. Verify share's `mode` permits the op.
3. Build absolute path = `source_path` + `/` + `subpath` (where `subpath` is
   validated via `safe_path` for `..`-rejection).
4. Delegate to FS code paths refactored to take an absolute base + subpath.

The handler runs as the **recipient's UID** (DEFINE_AUTH_ROUTE), so the
kernel enforces the ACL — even if the registry check is bypassed somehow,
the file op fails.

### 5. Expiry sweeper

New `src/share/sweeper.c` pthread, separate from the AWS-sync scheduler so
modules stay independent. 60s tick:

1. Read registry.
2. For each share where `expires_at != 0 && now >= expires_at && !revoked`:
   remove ACLs, mark `revoked: true`.
3. GC entries older than 30 days post-revocation.

Started from `main()` next to `aws_sync_scheduler_start()`.

### 6. Frontend

**API client** — `frontend/src/api/share.ts`:
- `createShare`, `revokeShare`, `listIncoming`, `listOutgoing`, `listUsers`
- Share-scoped FS ops (`shareList`, `shareStat`, `shareDownload`, …)

**Redux slice** — `frontend/src/store/slices/sharesSlice.ts`. Mirrors
`awsSyncSlice` shape.

**UI surfaces:**
- `FileContextMenu.tsx`: **Share…** menu item (not in trash mode).
- New `ShareDialog.tsx`: recipient combobox, mode radio (RO/RW for dirs,
  RO-only for files), expiry picker (1h, 1d, 7d, 30d, never).
- `PlacesPanel.tsx`: **Shared with me** entry; pseudo-path `shared:///`,
  mirrors `trash:///`.
- `FileBrowser.tsx`: when `currentPath === "shared:///"`, render incoming
  list. Click → `shared:///<id>` → uses share-scoped FS API.
- `Breadcrumbs.tsx`: shared-path display.
- `SettingsPage.tsx`: **Manage shares** card with revoke buttons.

### 7. Build wiring

- `Makefile`: append `-lacl` to `LDFLAGS`.
- New `.c` files picked up by existing `find … -name '*.c'` glob.

---

## Files

**New (backend):**
- `src/share/share.h` — types, decls.
- `src/share/share.c` — registry I/O, all handlers, libacl helpers.
- `src/share/sweeper.c` — pthread expiry sweeper.

**New (frontend):**
- `frontend/src/api/share.ts`
- `frontend/src/store/slices/sharesSlice.ts`
- `frontend/src/components/share/ShareDialog.tsx`
- `frontend/src/components/share/SharedWithMeView.tsx`
- `frontend/src/components/settings/ManageSharesCard.tsx`

**Modified (backend):**
- `src/main.c` — register routes, create `/var/lib/imaginary/`, start sweeper.
- `Makefile` — `-lacl`.

**Modified (frontend):**
- `frontend/src/store/index.ts` — register `shares` reducer.
- `frontend/src/components/files/FileContextMenu.tsx` — Share… item.
- `frontend/src/components/files/PlacesPanel.tsx` — Shared with me entry.
- `frontend/src/components/files/FileBrowser.tsx` — `shared:///` branch.
- `frontend/src/components/files/Breadcrumbs.tsx` — shared-path display.
- `frontend/src/pages/SettingsPage.tsx` — render `<ManageSharesCard />`.

**Reused, not re-implemented:**
- `write_atomic` pattern from `src/aws_sync/scheduler.c:50`.
- `parse_active_session_cookie` from `src/auth/session.c` for NOPRIV
  handlers.
- `safe_path` / `safe_filename` from `src/utils/utils.c`.
- `fs_error` for errno → HTTP mapping.
- FS read/write code paths from `src/fs/fs.c` (refactored to take an
  absolute base path).

---

## Verification

1. `make` — must remain zero-warning. Confirms `-lacl` link.
2. `(cd frontend && npx tsc --noEmit && npm run build)` — no type errors.
3. **Backend smoke** (`a` shares to `b`):
   - `POST /share` → `{id}`; `getfacl /home/a/test.txt` shows `user:b:r--`,
     `getfacl /home/a` shows `user:b:--x`.
   - As `b`: `GET /share/incoming` lists it; `GET /share/<id>/content`
     returns contents; `PUT /share/<id>/content` → 403 (RO).
   - As `a`: `DELETE /share/<id>` revokes; ACL gone.
4. **Folder RW** (`a` → `b`, `kind=dir, mode=rw`): `b` uploads via
   `/share/<id>/upload` → file appears in source dir.
5. **Expiry**: create with `expires_at = now+90`; wait 2 min; sweeper
   revokes; ACL gone.
6. **Stale source**: `mv` source after share; `/share/incoming` flags
   `stale: true`.
7. **Frontend smoke**: right-click → Share…; log in as `b` → Shared with
   me → open share → download. Settings → Manage shares → revoke.
8. **Negative tests**: share unowned file → 403; share to root/unknown →
   400; recipient mismatch on `/share/<id>/...` → 403; `..` subpath → 400.
9. Branch: `feat/file-sharing`. Commit using
   `Co-Authored-By: Jhaempyre <114846931+Jhaempyre@users.noreply.github.com>`.

---

## Out of scope (each its own follow-up PR)

Multi-recipient single-share entry · share groups · public/anonymous links ·
share notifications/inbox · inode-based tracking across rename · audit log
of access on shared paths · quota accounting · sharing through the trash
boundary · share-of-a-share (re-sharing).
