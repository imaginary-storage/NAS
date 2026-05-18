# Phase 7 — Autostart on boot

Run the service at machine boot without any extra user action.

This phase is almost entirely a consequence of Phase 6. It's tracked
separately so the requirement from prompt 23 is visible and verifiable.

## How it works

- `etc/imaginary-storage.service` (Phase 6) has `WantedBy=multi-user.target`.
- `install.sh` (Phase 5) runs `systemctl enable --now imaginary-storage`.
  - `enable` creates the symlink under `multi-user.target.wants/`.
  - `--now` starts immediately so users don't need to reboot.
- After install, every reboot brings the service up automatically.

## Failure modes & mitigations

| Failure                              | Mitigation                                       |
|--------------------------------------|--------------------------------------------------|
| Network not ready when service starts | `After=network-online.target` + `Wants=network-online.target` (Phase 6). |
| Disk holding `IMAGINARY_DATA_DIR` not mounted (e.g. external drive used as data dir) | Document: add `RequiresMountsFor=` to a drop-in if the user picks a non-default data dir. |
| Service crashes at boot              | `Restart=on-failure`, `RestartSec=2s` (Phase 6). |
| Repeated crash loops                 | Default systemd: 5 restarts per 10s, then unit fails. Documented; user can edit drop-in to tune. |

## User controls

- `systemctl disable imaginary-storage` — stop autostart, keep installed.
- `systemctl enable imaginary-storage` — re-enable.
- `--no-start` flag on `install.sh` — installs files & unit but does not
  enable. Useful for image baking.

## Drop-in directory

Document the standard systemd extension point so users can override
without editing the shipped unit (`install.sh` overwrites the unit on
upgrade):

```
/etc/systemd/system/imaginary-storage.service.d/override.conf
```

Common overrides documented in `INSTALL.md`:
- Run on a different port.
- Bind to a specific interface (via env var).
- Pre-mount a data disk (`RequiresMountsFor=/mnt/nas`).

## Deliverables

- [ ] No new files — verifies behaviour from Phase 5 + 6 deliverables.
- [ ] `INSTALL.md` section covering autostart, disable, and drop-ins.

## Verification

- After `install.sh`: `systemctl is-enabled imaginary-storage` → `enabled`.
- Reboot the VM → service comes up within ~5s of network availability.
- `systemctl disable` then reboot → service does not start.
- Crash test: `kill -9 $(systemctl show -p MainPID --value imaginary-storage)`
  → systemd restarts the service.
