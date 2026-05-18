# Deployment — `feat/deployment`

Single-script install/uninstall, semver-based releases, and systemd
lifecycle for Imaginary Storage NAS.

## Goals

- One command for end users: `curl -fsSL …/install.sh | sudo bash`.
- Reproducible, versioned releases shipped as prebuilt tarballs from
  GitHub Releases.
- The server runs as a normal Linux service: `systemctl start|stop|status
  imaginary-storage`, logs to journald, restarts on failure, starts at boot.
- Clean uninstall — one command removes everything (with an opt-in for
  per-user data).

## Locked decisions

| Topic            | Choice                                            |
|------------------|---------------------------------------------------|
| Init system      | systemd only                                      |
| Install layout   | `/opt/imaginary-storage/{bin,web,etc}` (self-contained) |
| Service user     | `root` (matches existing fork+setuid model)       |
| Install source   | GitHub Releases tarballs (curl-pipe-bash)         |
| Target arches    | `x86_64`, `aarch64` Linux                         |
| Default port     | `8080` (configurable via env)                     |

## Phases

The work is split into seven phases. Each phase has its own plan file.
Execution order matches the dependency chain — earlier phases must land
before later ones make sense.

1. [Phase 1 — Versioning](phase-1-versioning.md) — `VERSION` file as single
   source of truth; backend `/version` endpoint; frontend version banner.
2. [Phase 2 — Git tagging](phase-2-git-tagging.md) — `v<semver>` convention,
   `release.sh` helper.
3. [Phase 3 — CI release builds](phase-3-ci-releases.md) — extend the
   existing `release.yml` to ship arch-specific tarballs + SHA-256 sums.
4. [Phase 4 — Version bumping](phase-4-version-bumping.md) — `bump.sh`
   utility and documented release flow.
5. [Phase 5 — Install / uninstall scripts](phase-5-install-scripts.md) —
   `install.sh`, `uninstall.sh`, idempotent and upgrade-aware.
6. [Phase 6 — Lifecycle management](phase-6-lifecycle.md) — systemd unit,
   env-driven config, paths under `/var/lib`, graceful SIGTERM.
7. [Phase 7 — Autostart on boot](phase-7-autostart.md) — falls out of
   Phase 6; documented separately.

## Branch

All work lands on `feat/deployment` (off `main`). One PR per phase is
preferred but related phases (e.g. 6 + 7) can be bundled.

## Open items

- First-run admin bootstrap — current consensus: rely entirely on PAM /
  existing Linux accounts. No password prompt in `install.sh`.
- Migration story for users currently running `./run server` from a repo
  checkout — out of scope for v1; document a manual switch-over note in
  the release notes for the first tagged version.
- HTTP vs HTTPS default — stay HTTP on port 8080 for v1; HTTPS is opt-in
  via env (`IMAGINARY_TLS_CERT`, `IMAGINARY_TLS_KEY`).
