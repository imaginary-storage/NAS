# Installing Imaginary Storage NAS

A self-hosted, multi-user NAS for Linux. One script installs everything;
systemd keeps it running.

## Quick install

```bash
curl -fsSL https://github.com/imaginary-storage/NAS/releases/latest/download/install.sh \
  | sudo bash
```

That command downloads the latest release tarball, verifies its
SHA-256 checksum, installs files under `/opt/imaginary-storage/`,
writes a systemd unit, and starts the service. Default URL:
`http://<host>:8080`.

## Requirements

- Linux x86_64 or aarch64
- glibc 2.35 or newer (Ubuntu 22.04+, Debian 12+, Arch, Fedora 37+)
- `libpam` and `libacl` available at runtime
- `systemd` for service management
- `curl`, `tar`, `sha256sum` (usually preinstalled)

## Manual install from a tarball

If you'd rather not pipe `curl` into `bash`:

```bash
TAG=v0.1.0 ARCH=$(uname -m)
[ "$ARCH" = arm64 ] && ARCH=aarch64
curl -fsSLO "https://github.com/imaginary-storage/NAS/releases/download/${TAG}/imaginary-storage-${TAG}-linux-${ARCH}.tar.gz"
curl -fsSLO "https://github.com/imaginary-storage/NAS/releases/download/${TAG}/imaginary-storage-${TAG}-SHA256SUMS"
sha256sum -c imaginary-storage-${TAG}-SHA256SUMS
tar -xzf imaginary-storage-${TAG}-linux-${ARCH}.tar.gz
sudo ./imaginary-storage-${TAG}/install.sh
```

## Installer flags

```
sudo ./install.sh --help
```

| Flag                  | Default                | Meaning                                |
|-----------------------|------------------------|----------------------------------------|
| `--version vX.Y.Z`    | latest                 | Pin a specific version                 |
| `--prefix /path`      | `/opt/imaginary-storage` | Install prefix                        |
| `--port N`            | `8080`                 | First-install port (written to config) |
| `--no-start`          | start                  | Install files but don't enable/start   |
| `--yes` / `-y`        | interactive            | Skip confirmation prompts              |

## Layout

```
/opt/imaginary-storage/
  bin/server                            # the binary
  web/                                  # frontend
  etc/imaginary-storage.service         # unit template
  VERSION
/etc/systemd/system/
  imaginary-storage.service             # active unit (copy of the template)
/etc/imaginary-storage/
  config.env                            # editable; preserved across upgrades
/var/lib/imaginary-storage/
  sessions/                             # session files (mode 0700)
```

Per-user state (bookmarks, settings, trash, upload temp) lives under
`~/.imaginary/` in each user's home — the installer never touches it.

## Configuration — `/etc/imaginary-storage/config.env`

```env
IMAGINARY_PORT=8080
IMAGINARY_WEB_ROOT=/opt/imaginary-storage/web
IMAGINARY_DATA_DIR=/var/lib/imaginary-storage

# Optional HTTPS:
# IMAGINARY_TLS_CERT=/etc/imaginary-storage/tls.crt
# IMAGINARY_TLS_KEY=/etc/imaginary-storage/tls.key
```

Edit, then `sudo systemctl restart imaginary-storage`.

## Service management

```bash
systemctl status imaginary-storage        # is it up?
systemctl restart imaginary-storage       # apply config changes
systemctl stop imaginary-storage          # stop without disabling autostart
journalctl -u imaginary-storage -f        # live logs
curl localhost:8080/healthz               # liveness probe
curl localhost:8080/version               # version metadata
```

## Autostart on boot

`install.sh` runs `systemctl enable --now imaginary-storage`, so the
service starts at every boot. To disable autostart without uninstalling:

```bash
sudo systemctl disable imaginary-storage  # stops boot start
sudo systemctl enable  imaginary-storage  # re-enable
```

The unit declares `After=network-online.target` so the server doesn't
fight for the network on boot.

### systemd drop-ins (advanced)

The installer overwrites the active unit on every upgrade, so don't edit
it directly. For local overrides, create a drop-in:

```bash
sudo systemctl edit imaginary-storage
```

That opens `/etc/systemd/system/imaginary-storage.service.d/override.conf`.
Common overrides:

```ini
# Wait for an external mount before starting
[Unit]
RequiresMountsFor=/mnt/nas

# Raise the restart-failure tolerance
[Service]
StartLimitBurst=20
StartLimitIntervalSec=60
```

## Upgrades

Re-run the same installer — it detects the existing install, stops the
service, swaps files, and starts again. Your `config.env` and
`/var/lib/imaginary-storage/` are untouched.

```bash
curl -fsSL https://github.com/imaginary-storage/NAS/releases/latest/download/install.sh | sudo bash
```

To pin a specific version:

```bash
sudo ./install.sh --version v0.2.0
```

## Uninstall

```bash
sudo ./uninstall.sh             # removes binary + unit, keeps config + data
sudo ./uninstall.sh --purge     # also removes /etc/imaginary-storage and /var/lib/imaginary-storage
```

Per-user `~/.imaginary/` directories are **never** removed by the
uninstaller — each user owns their own data.

## Troubleshooting

**Service won't start.** Check `journalctl -u imaginary-storage -n 50`.
Most common cause: port 8080 already in use. Edit `config.env`,
change `IMAGINARY_PORT`, restart.

**HTTPS instead of HTTP.** Set `IMAGINARY_TLS_CERT` and
`IMAGINARY_TLS_KEY` in `config.env`, then restart.

**Behind a reverse proxy.** Point your proxy at
`http://localhost:8080`. The server doesn't need to know it's
proxied (cookies use `SameSite=Lax`).

**Firewall.** The installer does **not** open ports. On UFW:
`sudo ufw allow 8080/tcp`. On firewalld:
`sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload`.
