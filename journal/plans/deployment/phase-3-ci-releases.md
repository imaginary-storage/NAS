# Phase 3 — CI release builds

Turn `v*` tag pushes into signed, downloadable release artifacts.
Extends the existing (untracked) `.github/workflows/release.yml`.

## Current state

`release.yml` (already drafted, not yet committed) does:

- Builds `dist/server` on `ubuntu-latest` (x86_64) and `ubuntu-24.04-arm`
  (aarch64), with `libpam0g-dev libacl1-dev` installed.
- Builds the frontend on Node 20, zips `frontend/dist/` as
  `frontend-dist.zip`.
- Publishes each as a separate GitHub Release artifact via
  `softprops/action-gh-release@v2`.

Issues:
- Three separate downloads (`server-x86_64/server`, `server-aarch64/server`,
  `frontend-dist.zip`) — `install.sh` would need to fetch and stitch them.
- No version baked into the binary (Phase 1 fixes the macros but CI must
  pass them in).
- No checksums.
- No commit SHA in the build.

## Target

Per tag push, produce two release assets plus checksums:

```
imaginary-storage-vX.Y.Z-linux-x86_64.tar.gz
imaginary-storage-vX.Y.Z-linux-aarch64.tar.gz
imaginary-storage-vX.Y.Z-SHA256SUMS
```

Each tarball expands to:

```
imaginary-storage-vX.Y.Z/
  bin/server                     # the C binary, stripped
  web/                           # contents of frontend/dist/
  etc/imaginary-storage.service  # systemd unit template
  install.sh                     # installer (Phase 5)
  uninstall.sh                   # uninstaller (Phase 5)
  VERSION                        # plain X.Y.Z
  README.md                      # short post-install help
```

## Workflow changes

1. **Pass the version into the build.** Each build job:
   ```yaml
   - name: Set version env
     run: |
       echo "VERSION=$(cat VERSION)" >> $GITHUB_ENV
       echo "GIT_SHA=$(git rev-parse --short HEAD)" >> $GITHUB_ENV
   - name: Build
     run: make VERSION=$VERSION GIT_SHA=$GIT_SHA
   ```
   Makefile already picks `VERSION` from the file but explicit pass is
   safer for CI.

2. **Tag-name vs file consistency.** Add a sanity check step:
   ```bash
   tag="${GITHUB_REF_NAME}"      # e.g. v0.1.0
   file="v$(cat VERSION)"
   [ "$tag" = "$file" ] || { echo "tag/VERSION mismatch"; exit 1; }
   ```
   This catches a tag pushed without bumping `VERSION`.

3. **Combine artifacts into one tarball per arch.** New `package` job (or
   inline in `release`):
   ```bash
   stage="imaginary-storage-${tag}"
   mkdir -p "$stage"/{bin,web,etc}
   cp server-x86_64/server  "$stage/bin/server"     # one arch per run
   strip "$stage/bin/server"
   unzip -q frontend-dist/frontend-dist.zip -d /tmp/fe
   cp -r /tmp/fe/frontend/dist/* "$stage/web/"
   cp etc/imaginary-storage.service "$stage/etc/"
   cp install.sh uninstall.sh VERSION "$stage/"
   tar -czf "${stage}-linux-${arch}.tar.gz" "$stage"
   ```

4. **Checksums.** Single `SHA256SUMS` file covering both tarballs.
   `sha256sum *.tar.gz > imaginary-storage-${tag}-SHA256SUMS`.

5. **Release step.** `softprops/action-gh-release@v2` with `files:`
   pointing at the three artifacts. `generate_release_notes: true` for a
   first-pass changelog from PR titles.

6. **Strip the binary.** `strip dist/server` after `make` — drops ~30%
   size with no runtime impact.

## Build matrix

| OS runner             | Arch    | Notes                                |
|-----------------------|---------|--------------------------------------|
| `ubuntu-latest`       | x86_64  | Default                              |
| `ubuntu-24.04-arm`    | aarch64 | GitHub native arm runner             |

No macOS, no Windows. PAM is Linux-specific.

## Open question — glibc compatibility

Binaries built on `ubuntu-latest` (24.04) link against glibc 2.39. Older
distros (Debian 11, Ubuntu 20.04) will fail to run them.

Options:
- Ignore for v1; document "requires glibc ≥ 2.39 (Ubuntu 22.04+/Debian 12+)".
- Build on `ubuntu-22.04` runner for broader compat.
- Static link / musl — out of scope (PAM linking is complicated).

Recommendation: **build on `ubuntu-22.04` for the released binary** to
broaden reach. Single-line workflow change.

## Deliverables

- [ ] Commit `.github/workflows/release.yml` with the above changes.
- [ ] Add `imaginary-storage.service` template under `etc/` in the repo.
- [ ] Add a short `etc/RELEASE_README.md` that gets included in tarballs.
- [ ] First test release: `v0.1.0`.

## Verification

- Push tag `v0.1.0-test` from a branch to the user's fork; confirm:
  - Both tarballs produced.
  - SHA256SUMS valid (`sha256sum -c` on download).
  - `tar -tzf … | head` shows the expected layout.
  - `./bin/server` runs (in a VM) and `/version` reports `0.1.0`.
- Delete the test tag and release before tagging the real `v0.1.0`.
