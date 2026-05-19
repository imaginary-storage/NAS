# Imaginary Storage — release bundle

This tarball contains a prebuilt Imaginary Storage NAS server plus the
web frontend, ready to install on a Linux machine.

## Contents

```
imaginary-storage-vX.Y.Z/
  bin/server                     # the C HTTP server binary
  web/                           # built frontend (served by the binary)
  etc/imaginary-storage.service  # systemd unit
  install.sh                     # installer (root)
  uninstall.sh                   # uninstaller (root)
  VERSION                        # plain X.Y.Z
  README.md                      # this file
```

## Quick install

```bash
sudo ./install.sh
```

The installer:

1. Copies files to `/opt/imaginary-storage/`.
2. Creates `/etc/imaginary-storage/config.env` on first install (preserved on upgrade).
3. Installs the systemd unit and enables it at boot.
4. Starts the service.

Default URL after install: `http://<host>:8080`.

## Remote one-liner

```bash
curl -fsSL https://github.com/imaginary-storage/imaginary-storage-nas/releases/latest/download/install.sh | sudo bash
```

## Service control

```bash
systemctl status imaginary-storage
systemctl restart imaginary-storage
journalctl -u imaginary-storage -f
```

## Uninstall

```bash
sudo ./uninstall.sh           # keeps config + data
sudo ./uninstall.sh --purge   # also removes /etc/imaginary-storage and /var/lib/imaginary-storage
```

Per-user data under `~/.imaginary/` (sessions metadata, bookmarks, settings,
trash) is **never** removed by the uninstaller — users own their data.

## Requirements

- Linux x86_64 or aarch64
- glibc 2.35+ (Ubuntu 22.04 / Debian 12 / Arch / Fedora 37+)
- `libpam` and `libacl` available at runtime

## Source

https://github.com/imaginary-storage/imaginary-storage-nas
