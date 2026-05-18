# Phase 2 — Git tagging & release convention

Make `git tag` the trigger for a release. Keep the tagging workflow
scriptable and consistent.

## Conventions

- Tag format: **`v<MAJOR>.<MINOR>.<PATCH>`** — e.g. `v0.1.0`.
- Tags are **annotated** (`git tag -a`), with a short message:
  `Release v0.1.0`.
- The tag's `VERSION` content must match the tag name (verified by
  `release.sh`). This ensures the binary's `IMAGINARY_VERSION` and the
  GitHub Release name always agree.
- The existing `release.yml` already triggers on `push: tags: ['v*']` —
  no workflow change needed here.

## `scripts/release.sh`

A guarded helper that performs the tag + push.

Behaviour:
1. `set -euo pipefail`.
2. Verify working tree is clean (`git diff --quiet && git diff --cached --quiet`).
3. Verify current branch is `main` (override with `--allow-branch`).
4. Read `VERSION`; compute `TAG="v$(cat VERSION)"`.
5. Verify the tag does not already exist locally or on `origin`.
6. Print summary (version, tag, last 5 commits since last tag) and prompt
   `Continue? [y/N]` unless `--yes` is passed.
7. `git tag -a "$TAG" -m "Release $TAG"`.
8. `git push origin "$TAG"`.
9. Print the Releases URL so the user can watch CI.

What `release.sh` does **not** do:
- Bump the version (that is `bump.sh`, Phase 4).
- Build anything (CI handles that, Phase 3).
- Create a GitHub Release directly (CI does that via `softprops/action-gh-release`).

## Release flow (post-Phase 4)

```
scripts/bump.sh patch        # edits VERSION
git diff && git commit -am "chore: release v0.1.1"
scripts/release.sh           # tags + pushes, CI takes over
```

## Out of scope

- Changelog automation (e.g. `git-cliff`) — manual release notes for now.
- Pre-releases (`v0.1.0-rc.1`) — supported by the tag pattern but not
  exercised in CI until needed.

## Deliverables

- [ ] `scripts/release.sh` executable, with `--help` and `--yes`.
- [ ] Documentation snippet in `CLAUDE.md` describing the release flow.

## Verification

- Dry-run on a throwaway branch: create a fake tag, push to a personal
  fork, watch the workflow fire. Delete after.
- `release.sh` on a dirty tree → aborts.
- `release.sh` when tag already exists → aborts.
