# Phase 1 — Versioning

Establish a **single source of truth** for the project version so the
backend binary, the frontend bundle, and release artifacts always agree.

## Source of truth

- New file at repo root: **`VERSION`** containing a single line, e.g.
  `0.1.0`. No prefix, no whitespace. Semantic versioning (MAJOR.MINOR.PATCH).
- Initial value: `0.1.0` (pre-1.0 — breaking changes allowed until the
  product stabilises).

## Backend wiring

- `Makefile` reads `VERSION` at build time:
  ```make
  VERSION := $(shell cat VERSION)
  GIT_SHA := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
  CFLAGS  += -DIMAGINARY_VERSION=\"$(VERSION)\" \
             -DIMAGINARY_GIT_SHA=\"$(GIT_SHA)\" \
             -DIMAGINARY_BUILD_AT=\"$(shell date -u +%FT%TZ)\"
  ```
- New endpoint `GET /version` in `src/routes/` (likely a new file
  `version.c`, registered in `src/main.c`). **Unauthenticated** — needed
  for the frontend match check before login. Response:
  ```json
  { "version": "0.1.0", "commit": "ab12cd3", "built_at": "2026-05-19T…" }
  ```
- The same constants can be used to set a `Server:` response header (nice
  touch; small change in `lib/chttp.c`).

## Frontend wiring

- `frontend/vite.config.ts`: read `../VERSION` synchronously at config
  evaluation; expose via `define`:
  ```ts
  define: { __APP_VERSION__: JSON.stringify(version) }
  ```
- Add `declare const __APP_VERSION__: string;` to `frontend/src/vite-env.d.ts`.
- Display version in the sidebar footer (next to the theme toggle) — small,
  muted text: `v0.1.0`.

## Version match check (frontend ↔ backend)

- On app boot (`App.tsx` or `main.tsx`), fetch `/version` once.
- If `data.version !== __APP_VERSION__`, show a Sonner toast:
  *"A new version is available. Reload to update."* with a "Reload" action.
- Rationale: after an upgrade, a browser with the old SPA in memory will
  keep talking to the new backend; the toast nudges users to refresh.

## Out of scope for this phase

- No automated version bumping (Phase 4).
- No git tagging (Phase 2).
- No release artifacts (Phase 3).

## Deliverables

- [ ] `VERSION` file at repo root.
- [ ] Makefile injects version/commit/build-time as `-D` macros.
- [ ] `src/routes/version.c` + registration in `main.c`.
- [ ] `vite.config.ts` exposes `__APP_VERSION__`.
- [ ] Sidebar footer shows version.
- [ ] Boot-time `/version` mismatch toast.
- [ ] `CLAUDE.md` updated to document the `VERSION` workflow.

## Verification

- `make` then `./dist/server`; `curl localhost:8080/version` returns the
  expected JSON.
- `cd frontend && npm run build` then check `frontend/dist/assets/*.js`
  contains the version string.
- Manually bump `VERSION` to `0.1.1`, rebuild only the backend, open the
  frontend pointing at the rebuilt backend → toast appears.

## Risk / notes

- Reading `VERSION` from `vite.config.ts` makes the file load synchronous —
  fine, it's tiny.
- `git rev-parse` in the Makefile falls back to `unknown` outside a git
  checkout (CI tarball extraction case is handled in Phase 3 by passing
  `GIT_SHA` from the workflow).
