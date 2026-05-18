# Phase 4 — Version bumping

A tiny utility so version bumps are mechanical and consistent, and the
release flow has exactly two commands.

## `scripts/bump.sh`

Behaviour:

```
scripts/bump.sh major     # 0.1.3 → 1.0.0
scripts/bump.sh minor     # 0.1.3 → 0.2.0
scripts/bump.sh patch     # 0.1.3 → 0.1.4
scripts/bump.sh set 1.2.3 # explicit override (validated)
scripts/bump.sh --print   # echo current, no change
```

Steps:
1. `set -euo pipefail`.
2. Parse current `VERSION` with a strict regex: `^([0-9]+)\.([0-9]+)\.([0-9]+)$`.
3. Compute next version.
4. Write `VERSION` atomically (`tmp + mv`).
5. Print `0.1.3 -> 0.1.4`.
6. **Does not commit, tag, or push.** Leaves the file dirty for review.

Rationale for splitting from `release.sh`: lets the user inspect the diff
before tagging, and lets unrelated bump-in-PR flows exist later (e.g.
"bump the dev version after a release" if we adopt that).

## Documented release flow

Add to `CLAUDE.md` (under a new "Releases" section):

```
# Releases

The version lives in VERSION at repo root. Bumping is a two-step flow:

  scripts/bump.sh patch              # edit VERSION
  git commit -am "chore: release v$(cat VERSION)"
  scripts/release.sh                 # tag + push, CI takes over

CI then builds tarballs and publishes a GitHub Release.
```

## Coordination with the frontend

The frontend's bundled version comes from `vite.config.ts` reading
`../VERSION` at build time (Phase 1). The bump is therefore picked up by
the next `npm run build` — no separate `package.json` version update
needed. Decision: **do not sync `frontend/package.json` version**; it
stays at a static `0.0.0` and is meaningless (the package isn't
published).

## Deliverables

- [ ] `scripts/bump.sh` executable, with `--help` and `--print`.
- [ ] `CLAUDE.md` updated with the release flow.

## Verification

- `bump.sh patch` then `git diff VERSION` shows only the version line.
- `bump.sh set 1.2.3` validates the input; `bump.sh set foo` exits 1.
- Round-trip with `release.sh` (Phase 2) on a test branch.

## Out of scope

- Auto-bumping based on commit messages (conventional-commits → semver).
- `package.json` sync.
- Pre-release tags (`-rc.N`).
