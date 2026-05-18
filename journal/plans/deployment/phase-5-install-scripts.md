# Phase 5 — Install / uninstall scripts

End-user-facing scripts. Should "just work" on a fresh Ubuntu/Debian/Arch
machine with curl and sudo.

## `install.sh`

Two invocation styles, both supported:

```
# Remote (curl-pipe-bash)
curl -fsSL https://github.com/<owner>/<repo>/releases/latest/download/install.sh | sudo bash

# From an extracted tarball (after manual download)
sudo ./install.sh
```

The script can detect which mode it's in: if `VERSION` and `bin/server`
sit next to it, use local files; otherwise download.

### Flags

| Flag                 | Meaning                                          |
|----------------------|--------------------------------------------------|
| `--version vX.Y.Z`   | Pin a specific version (default: latest release) |
| `--prefix /path`     | Override install prefix (default: `/opt/imaginary-storage`) |
| `--port N`           | First-install port (default: 8080)               |
| `--no-start`         | Install but don't enable/start                   |
| `--yes`              | Skip interactive prompts                         |
| `--help`             | Usage                                            |

### Steps

1. **Preflight**
   - `set -euo pipefail`.
   - Require `EUID == 0` (instructive error if not).
   - `arch=$(uname -m)`; map: `x86_64` → `x86_64`, `aarch64`/`arm64` → `aarch64`. Anything else: abort with a clear message.
   - Detect package manager (`apt`/`dnf`/`pacman`) for the dependency hint.
2. **Dependencies**
   - Required at runtime: `libpam`, `libacl`, `ca-certificates` (for HTTPS downloads), `tar`, `curl`.
   - Check via `ldconfig -p | grep …` for the libs; for tools, `command -v`.
   - If missing: print the exact install command for the detected pkg manager and ask `Install now? [Y/n]` (skip prompt with `--yes`).
3. **Resolve version**
   - If `--version` given, use it.
   - Else `curl -fsSL https://api.github.com/repos/<owner>/<repo>/releases/latest` → parse `tag_name`.
4. **Download** (skip if running from extracted tarball)
   - Tarball URL: `…/releases/download/<tag>/imaginary-storage-<tag>-linux-<arch>.tar.gz`.
   - Sums URL: `…/imaginary-storage-<tag>-SHA256SUMS`.
   - `curl -fsSL` to a `mktemp -d` workdir; verify checksum (`sha256sum -c`); extract.
5. **Upgrade detection**
   - If `/opt/imaginary-storage/VERSION` exists and differs from the new
     version: log "Upgrading X.Y.Z → A.B.C"; stop service (`systemctl stop
     imaginary-storage 2>/dev/null || true`).
   - If equal: ask `Reinstall? [y/N]` unless `--yes`.
   - If missing: fresh install.
6. **Install files**
   ```
   /opt/imaginary-storage/
     bin/server
     web/
     VERSION
     etc/imaginary-storage.service   # template (also referenced from systemd)
   ```
   `rsync -a --delete-after staged/ /opt/imaginary-storage/` (keeps perms;
   `--delete-after` purges files removed in the new version).
7. **Config** (preserved across upgrades)
   - On **first install only**: write `/etc/imaginary-storage/config.env`:
     ```
     IMAGINARY_PORT=8080
     IMAGINARY_WEB_ROOT=/opt/imaginary-storage/web
     IMAGINARY_DATA_DIR=/var/lib/imaginary-storage
     # IMAGINARY_TLS_CERT=
     # IMAGINARY_TLS_KEY=
     ```
   - On upgrades: leave the existing file alone. If new env vars are
     introduced, append commented defaults at the bottom (with version note).
8. **Data dirs** (created if missing, never wiped)
   - `/var/lib/imaginary-storage/sessions` (mode 0700, owner root).
   - `/var/log/imaginary-storage/` — not used yet (we log to journald); created as a placeholder for future file-logging.
9. **systemd unit**
   - Copy `etc/imaginary-storage.service` → `/etc/systemd/system/imaginary-storage.service`.
   - `systemctl daemon-reload`.
   - Unless `--no-start`: `systemctl enable --now imaginary-storage`.
10. **Post-install summary**
    - Print version, port, service status, and `journalctl` hint.
    - Print the URL: `http://$(hostname -I | awk '{print $1}'):${PORT}`.

### Idempotence rules

- Running `install.sh` twice in a row with the same version is safe and
  produces the same final state.
- Running with `--version` newer than installed upgrades; older
  downgrades (with prompt unless `--yes`).
- Config and data files are **never** overwritten on upgrade.

## `uninstall.sh`

```
sudo ./uninstall.sh           # interactive: keeps data, prompts to confirm
sudo ./uninstall.sh --purge   # also removes /etc/imaginary-storage and warns about per-user data
sudo ./uninstall.sh --yes     # no prompts
```

Steps:
1. Require root.
2. `systemctl disable --now imaginary-storage 2>/dev/null || true`.
3. `rm -f /etc/systemd/system/imaginary-storage.service` then `daemon-reload`.
4. `rm -rf /opt/imaginary-storage`.
5. Default: leave `/etc/imaginary-storage` and `/var/lib/imaginary-storage` alone, print where they are.
6. `--purge`: remove `/etc/imaginary-storage` and `/var/lib/imaginary-storage`. Always warn that per-user `~/.imaginary/` directories are **not** touched (each user owns theirs).
7. Print "Uninstalled. Per-user data left at: ~/.imaginary/ (sharer can remove manually)."

## Style

- Colored output via tput when `[ -t 1 ]`; plain otherwise.
- Functions: `info`, `warn`, `error`, `die`.
- All errors include "what failed" and "what to try".
- Scripts pass `shellcheck` without warnings.

## Deliverables

- [ ] `install.sh` at repo root (so it's also accessible via the latest-release
      direct link).
- [ ] `uninstall.sh` at repo root.
- [ ] Both bundled into release tarballs (Phase 3).
- [ ] `etc/imaginary-storage.service` template committed.
- [ ] First-install README short doc (top-level `INSTALL.md`).

## Verification

- Fresh Ubuntu 22.04 VM:
  - `curl | bash` → service running, URL responds.
  - `install.sh` again → "already at version X, reinstall?" prompt.
  - `bump VERSION` server-side; rerun → upgrade path taken; service back up.
  - `uninstall.sh` → service gone, `/opt/imaginary-storage` gone, data preserved.
  - `uninstall.sh --purge` → everything except `~/.imaginary/` gone.
- Fresh Arch VM: same checks (different pkg manager hints).
- Architecture mismatch test: try installing aarch64 tarball on x86_64 — script must refuse.

## Risk / notes

- `curl | bash` is convenient but loses error context on partial downloads.
  Mitigation: the remote one-liner downloads `install.sh` first (`curl
  -fsSL …/install.sh -o /tmp/install.sh`), `sha256sum -c` against a small
  inline expected hash optional, then `bash /tmp/install.sh`.
- The script does **not** open firewall ports — too distro-specific.
  Documented post-install hint.
