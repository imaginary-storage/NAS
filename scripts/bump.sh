#!/usr/bin/env bash
#
# bump.sh — edit the VERSION file in place.
#
# Usage:
#   scripts/bump.sh major          # X.Y.Z -> (X+1).0.0
#   scripts/bump.sh minor          # X.Y.Z -> X.(Y+1).0
#   scripts/bump.sh patch          # X.Y.Z -> X.Y.(Z+1)
#   scripts/bump.sh set 1.2.3      # explicit, validated
#   scripts/bump.sh --print        # echo current, no change
#   scripts/bump.sh --help
#
# Does NOT commit, tag, or push. Pair with scripts/release.sh.

set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

[ -f VERSION ] || { echo "error: VERSION file not found" >&2; exit 1; }

current=$(tr -d '[:space:]' < VERSION)
[[ "$current" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]] || {
  echo "error: current VERSION '$current' is not valid semver" >&2
  exit 1
}
major=${BASH_REMATCH[1]}
minor=${BASH_REMATCH[2]}
patch=${BASH_REMATCH[3]}

mode=${1:-}
case "$mode" in
  major)  next="$((major + 1)).0.0" ;;
  minor)  next="${major}.$((minor + 1)).0" ;;
  patch)  next="${major}.${minor}.$((patch + 1))" ;;
  set)
    next=${2:-}
    [[ "$next" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
      echo "error: '$next' is not a valid semver MAJOR.MINOR.PATCH" >&2
      exit 1
    }
    ;;
  --print|-p)
    echo "$current"
    exit 0
    ;;
  --help|-h|"")
    sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
    [ -z "$mode" ] && exit 1 || exit 0
    ;;
  *)
    echo "error: unknown mode '$mode'" >&2
    echo "       valid: major | minor | patch | set <X.Y.Z> | --print" >&2
    exit 1
    ;;
esac

# atomic write
tmp=$(mktemp)
printf '%s\n' "$next" > "$tmp"
mv "$tmp" VERSION

printf '%s -> %s\n' "$current" "$next"
