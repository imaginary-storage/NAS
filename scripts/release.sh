#!/usr/bin/env bash
#
# release.sh — tag the current commit as v$(cat VERSION) and push.
#
# Pairs with scripts/bump.sh (Phase 4). Does NOT bump the version,
# NOT commit, NOT build — just tags and pushes. CI handles the rest.
#
# Usage:
#   scripts/release.sh                # interactive
#   scripts/release.sh --yes          # skip confirmation
#   scripts/release.sh --allow-branch # allow tagging from a non-main branch
#   scripts/release.sh --help

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# ---- styling -------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$(tput sgr0); C_BOLD=$(tput bold)
  C_RED=$(tput setaf 1); C_YELLOW=$(tput setaf 3); C_GREEN=$(tput setaf 2)
else
  C_RESET=; C_BOLD=; C_RED=; C_YELLOW=; C_GREEN=
fi
info()  { printf '%s==>%s %s\n' "$C_BOLD" "$C_RESET" "$*"; }
warn()  { printf '%swarn:%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
die()   { printf '%serror:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# ---- args ----------------------------------------------------------------
ASSUME_YES=0
ALLOW_BRANCH=0
for arg in "$@"; do
  case "$arg" in
    --yes|-y)        ASSUME_YES=1 ;;
    --allow-branch)  ALLOW_BRANCH=1 ;;
    --help|-h)
      sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) die "unknown argument: $arg" ;;
  esac
done

# ---- checks --------------------------------------------------------------
[ -f VERSION ] || die "VERSION file not found at repo root"

VERSION=$(tr -d '[:space:]' < VERSION)
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] \
  || die "VERSION '$VERSION' is not a valid semver MAJOR.MINOR.PATCH"

TAG="v$VERSION"

if ! git diff --quiet || ! git diff --cached --quiet; then
  die "working tree is dirty — commit or stash first"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] && [ "$ALLOW_BRANCH" -ne 1 ]; then
  die "current branch is '$BRANCH', not main (pass --allow-branch to override)"
fi

if git rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  die "tag $TAG already exists locally"
fi
if git ls-remote --exit-code --tags origin "$TAG" >/dev/null 2>&1; then
  die "tag $TAG already exists on origin"
fi

# ---- summary -------------------------------------------------------------
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
RANGE=${LAST_TAG:+"$LAST_TAG..HEAD"}
RANGE=${RANGE:-HEAD}

info "Releasing ${C_BOLD}$TAG${C_RESET} from branch ${C_BOLD}$BRANCH${C_RESET}"
printf '\n%sCommits since %s:%s\n' "$C_BOLD" "${LAST_TAG:-the beginning}" "$C_RESET"
git log --pretty=format:'  %h %s' "$RANGE" | head -20
printf '\n\n'

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Tag and push $TAG? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) die "aborted" ;;
  esac
fi

# ---- tag + push ----------------------------------------------------------
info "Creating annotated tag $TAG"
git tag -a "$TAG" -m "Release $TAG"

info "Pushing tag to origin"
git push origin "$TAG"

REMOTE_URL=$(git config --get remote.origin.url || true)
RELEASES_URL=$(
  echo "$REMOTE_URL" \
    | sed -E 's#^git@github\.com:#https://github.com/#; s#\.git$##' \
    | sed -E 's#^(https://[^/]+/[^/]+/[^/]+).*#\1#'
)
if [ -n "${RELEASES_URL:-}" ]; then
  printf '\n%sDone.%s Watch CI here: %s/actions\n'   "$C_GREEN" "$C_RESET" "$RELEASES_URL"
  printf '%sReleases:%s            %s/releases\n'    "$C_GREEN" "$C_RESET" "$RELEASES_URL"
else
  info "Done. Tag pushed."
fi
