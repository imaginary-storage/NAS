# Phase 6 — Lifecycle management

Make the server behave like a well-mannered Linux service: configured
from env, logs to journal, restarts on failure, shuts down cleanly on
SIGTERM, and stores its state under FHS-conformant paths.

This phase has **server-side code changes** as well as the systemd unit.
The code changes block Phase 5 — they should land first or together.

## Server-side changes

### Config from environment

Replace hard-coded values in `src/main.c`:

| Env var                 | Default                              | Purpose                  |
|-------------------------|--------------------------------------|--------------------------|
| `IMAGINARY_PORT`        | `8080`                               | Listen port              |
| `IMAGINARY_WEB_ROOT`    | `./frontend/dist` (dev) / `/opt/…/web` (prod) | Static SPA root |
| `IMAGINARY_DATA_DIR`    | `./` (dev) / `/var/lib/imaginary-storage` (prod) | Sessions, uploads, etc. base |
| `IMAGINARY_TLS_CERT`    | unset                                | If set, enable HTTPS     |
| `IMAGINARY_TLS_KEY`     | unset                                | Pair with cert           |

Implementation:
- Small helper `getenv_or(const char *name, const char *fallback)` in
  `src/utils/utils.c`.
- `main.c` reads these once at startup and passes them to `chttp_server_init`,
  static file handler (`src/routes/static.c`), and wherever the session/upload
  paths are constructed.

### Sessions & uploads under `IMAGINARY_DATA_DIR`

Today:
- Sessions live in `./sessions/` (CWD-relative).
- Uploads live in `~/.imaginary/uploads/` (per-user — keep this; it's the
  authenticated user's home).

Change:
- Sessions move to `${IMAGINARY_DATA_DIR}/sessions/` (root-owned, mode 0700).
  Server creates the dir on boot if missing.
- Update `src/auth/session.c` to use this base path (probably wire through
  a global set in `main.c`).
- Per-user paths (`~/.imaginary/...`) remain unchanged — they live in the
  authenticated user's home and Phase 6 doesn't touch them.

### Graceful shutdown on SIGTERM

systemd sends SIGTERM, waits `TimeoutStopSec` (default 90s), then SIGKILL.
Today the server probably ignores SIGTERM or dies abruptly.

Add:
- `signal(SIGTERM, on_term)` and `signal(SIGINT, on_term)` in `main.c`.
- Handler sets a `volatile sig_atomic_t shutting_down = 1` flag.
- `chttp` accept loop checks the flag between accepts (needs a small change
  in `lib/chttp.c` — make accept interruptible by closing the listen fd, or
  use a pipe-to-self trick).
- On shutdown: close listen fd, wait briefly for child workers (the
  fork+setuid children) to finish — they're independent processes so we
  don't need to track them; `waitpid(-1, NULL, WNOHANG)` in a short loop.

### Logging to stdout/stderr

Already mostly true — verify all `fprintf(stderr, ...)` and `printf(...)`
calls and ensure nothing tries to write to a log file. systemd will redirect
stdout/stderr to the journal (`StandardOutput=journal`).

### Health endpoint (small bonus)

While we're here: `GET /healthz` returning `200 OK` with body `ok`. Useful
for systemd readiness checks and any future load balancer.

## systemd unit — `etc/imaginary-storage.service`

```ini
[Unit]
Description=Imaginary Storage NAS
Documentation=https://github.com/<owner>/<repo>
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
EnvironmentFile=-/etc/imaginary-storage/config.env
ExecStart=/opt/imaginary-storage/bin/server
WorkingDirectory=/opt/imaginary-storage
Restart=on-failure
RestartSec=2s
TimeoutStopSec=30s
KillSignal=SIGTERM
StandardOutput=journal
StandardError=journal

# Lightweight hardening compatible with the fork+setuid model.
# We CANNOT use: NoNewPrivileges (breaks setuid), ProtectHome (we read
# home dirs as the dropped-priv user), PrivateUsers (breaks setuid).
ProtectSystem=full
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

[Install]
WantedBy=multi-user.target
```

- `EnvironmentFile=-` (leading `-`) — missing file is not a fatal error.
- `ProtectSystem=full` makes `/usr`, `/boot`, `/etc` read-only for the
  service while allowing `/var` and `/opt`. Safe with our paths.
- Hardening choices documented inline since they intersect with setuid.

## Optional: `imaginary-ctl` wrapper

A 30-line shell script installed to `/usr/local/bin/imaginary-ctl`:

```
imaginary-ctl status      # systemctl status …
imaginary-ctl logs        # journalctl -u imaginary-storage -f
imaginary-ctl restart     # systemctl restart …
imaginary-ctl version     # curl -s localhost:<port>/version | jq
imaginary-ctl config      # ${EDITOR:-nano} /etc/imaginary-storage/config.env && reload
```

Nice-to-have, not blocking.

## Deliverables

- [ ] `src/main.c`: env-driven config; signal handlers; data dir bootstrap.
- [ ] `src/auth/session.c`: sessions path comes from `IMAGINARY_DATA_DIR`.
- [ ] `lib/chttp.c`: interruptible accept loop.
- [ ] `GET /healthz` route.
- [ ] `etc/imaginary-storage.service` committed.
- [ ] (optional) `scripts/imaginary-ctl` installed by Phase 5.

## Verification

- `IMAGINARY_PORT=9999 ./dist/server` listens on 9999.
- `kill -TERM $(pidof server)` exits in <1s with status 0.
- `systemctl start imaginary-storage` and `journalctl -u imaginary-storage`
  shows boot lines.
- `curl localhost:8080/healthz` returns `ok`.
- Kill `-9` → systemd restarts the service within 2s.

## Risk / notes

- The interruptible accept change in `chttp` is the riskiest bit. Smallest
  safe approach: in the shutdown handler, `shutdown(listen_fd, SHUT_RDWR)` —
  `accept()` returns with `EINVAL`/`EBADF` and the loop exits when it sees
  the flag.
- Existing dev workflow (`./run server` from a checkout) keeps working
  because all new env vars have sensible dev defaults.
