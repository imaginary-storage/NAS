#!/usr/bin/env bash
#
# install.sh — Imaginary Storage NAS installer.
#
# Two ways to run it:
#
#   # Remote (curl-pipe-bash):
#   curl -fsSL nas.imaginarystorage.com/install.sh | sudo bash
#
#   # From an extracted release tarball:
#   sudo ./install.sh
#
# Flags:
#   --version vX.Y.Z   Install a specific version (default: latest)
#   --prefix /path     Install prefix (default: /opt/imaginary-storage)
#   --port N           First-install port (default: 8080)
#   --no-start         Install but don't enable/start the service
#   --yes / -y         Skip confirmation prompts
#   --help / -h
#
# Layout after install:
#   /opt/imaginary-storage/{bin,web,etc,VERSION}
#   /etc/systemd/system/imaginary-storage.service
#   /etc/imaginary-storage/config.env       (preserved across upgrades)
#   /var/lib/imaginary-storage/sessions/    (sessions, preserved)

set -euo pipefail

# ---- repo (used to build download URLs) ---------------------------------
REPO_OWNER="imaginary-storage"
REPO_NAME="NAS"
REPO_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}"
API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}"

# ---- defaults -----------------------------------------------------------
PREFIX="/opt/imaginary-storage"
CONFIG_DIR="/etc/imaginary-storage"
DATA_DIR="/var/lib/imaginary-storage"
SERVICE_NAME="imaginary-storage"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
DEFAULT_PORT=8080

VERSION_OVERRIDE=""
PORT="${DEFAULT_PORT}"
NO_START=0
ASSUME_YES=0

# ---- styling ------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$(tput sgr0); C_BOLD=$(tput bold)
  C_RED=$(tput setaf 1); C_YELLOW=$(tput setaf 3); C_GREEN=$(tput setaf 2)
else
  C_RESET=; C_BOLD=; C_RED=; C_YELLOW=; C_GREEN=
fi
info() { printf '%s==>%s %s\n' "$C_BOLD" "$C_RESET" "$*"; }
warn() { printf '%swarn:%s %s\n' "$C_YELLOW" "$C_RESET" "$*" >&2; }
ok()   { printf '%sok:%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
die()  { printf '%serror:%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; exit 1; }

# ---- args ---------------------------------------------------------------
print_help() { sed -n '3,25p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --version)    VERSION_OVERRIDE="$2"; shift 2 ;;
    --prefix)     PREFIX="$2"; shift 2 ;;
    --port)       PORT="$2"; shift 2 ;;
    --no-start)   NO_START=1; shift ;;
    --yes|-y)     ASSUME_YES=1; shift ;;
    --help|-h)    print_help; exit 0 ;;
    *)            die "unknown argument: $1" ;;
  esac
done

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  local prompt="$1"
  read -r -p "$prompt [y/N] " reply
  case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# ---- preflight ----------------------------------------------------------
[ "$(id -u)" -eq 0 ] || die "must run as root (try: sudo $0)"

case "$(uname -s)" in
  Linux) ;;
  *) die "this installer supports Linux only" ;;
esac

case "$(uname -m)" in
  x86_64|amd64)        ARCH="x86_64" ;;
  aarch64|arm64)       ARCH="aarch64" ;;
  *) die "unsupported architecture: $(uname -m)" ;;
esac

# Detect package manager — for the dependency-install hint, not strictly required.
PKG_MANAGER=""
PKG_INSTALL_HINT=""
if   command -v apt-get >/dev/null; then PKG_MANAGER=apt;    PKG_INSTALL_HINT="apt-get install -y libpam0g libacl1 ca-certificates"
elif command -v dnf     >/dev/null; then PKG_MANAGER=dnf;    PKG_INSTALL_HINT="dnf install -y pam libacl ca-certificates"
elif command -v pacman  >/dev/null; then PKG_MANAGER=pacman; PKG_INSTALL_HINT="pacman -S --needed pam acl ca-certificates"
fi

check_lib() { ldconfig -p 2>/dev/null | grep -q "$1"; }
need_libs=()
check_lib libpam.so.0 || need_libs+=("libpam")
check_lib libacl.so.1 || need_libs+=("libacl")
if [ "${#need_libs[@]}" -gt 0 ]; then
  warn "missing runtime libraries: ${need_libs[*]}"
  if [ -n "$PKG_INSTALL_HINT" ]; then
    printf '  To install: %s\n' "$PKG_INSTALL_HINT"
  fi
  confirm "Continue anyway?" || die "aborted — install the libraries and re-run"
fi

for t in tar curl sha256sum systemctl; do
  command -v "$t" >/dev/null || die "missing required tool: $t"
done

# ---- locate or fetch the bundle -----------------------------------------
WORK=""
cleanup() { [ -n "$WORK" ] && [ -d "$WORK" ] && rm -rf "$WORK"; }
trap cleanup EXIT

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd 2>/dev/null || pwd)

if [ -f "${SCRIPT_DIR}/VERSION" ] && [ -x "${SCRIPT_DIR}/bin/server" ]; then
  info "Installing from local bundle at ${SCRIPT_DIR}"
  STAGE="${SCRIPT_DIR}"
  NEW_VERSION=$(tr -d '[:space:]' < "${SCRIPT_DIR}/VERSION")
else
  if [ -n "$VERSION_OVERRIDE" ]; then
    TAG="$VERSION_OVERRIDE"
    [[ "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || TAG="v${TAG}"
  else
    info "Resolving latest release"
    TAG=$(curl -fsSL "${API_URL}/releases/latest" \
            | grep -oE '"tag_name"[[:space:]]*:[[:space:]]*"[^"]+"' \
            | head -1 \
            | sed -E 's/.*"([^"]+)"$/\1/') \
      || die "failed to query GitHub API for latest release"
    [ -n "$TAG" ] || die "could not determine latest release"
  fi
  NEW_VERSION="${TAG#v}"
  TARBALL="imaginary-storage-${TAG}-linux-${ARCH}.tar.gz"
  SUMS="imaginary-storage-${TAG}-SHA256SUMS"
  BASE="${REPO_URL}/releases/download/${TAG}"

  WORK=$(mktemp -d)
  info "Downloading ${TARBALL}"
  curl -fsSL -o "${WORK}/${TARBALL}" "${BASE}/${TARBALL}" \
    || die "download failed: ${BASE}/${TARBALL}"
  curl -fsSL -o "${WORK}/${SUMS}"    "${BASE}/${SUMS}"    \
    || die "download failed: ${BASE}/${SUMS}"

  info "Verifying checksum"
  (cd "$WORK" && grep " ${TARBALL}$" "${SUMS}" | sha256sum -c -) \
    || die "checksum verification failed for ${TARBALL}"

  info "Extracting"
  tar -xzf "${WORK}/${TARBALL}" -C "${WORK}"
  STAGE="${WORK}/imaginary-storage-${TAG}"
  [ -f "${STAGE}/VERSION" ] || die "extracted bundle is missing VERSION"
fi

# ---- upgrade detection --------------------------------------------------
ACTION="install"
if [ -f "${PREFIX}/VERSION" ]; then
  OLD_VERSION=$(tr -d '[:space:]' < "${PREFIX}/VERSION")
  if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
    if ! confirm "Already installed at version ${OLD_VERSION}. Reinstall?"; then
      ok "Nothing to do."
      exit 0
    fi
    ACTION="reinstall"
  else
    info "Upgrading ${OLD_VERSION} → ${NEW_VERSION}"
    ACTION="upgrade"
  fi

  if systemctl is-active --quiet "${SERVICE_NAME}"; then
    info "Stopping ${SERVICE_NAME}"
    systemctl stop "${SERVICE_NAME}" || warn "stop failed (will continue)"
  fi
fi

# ---- install files ------------------------------------------------------
info "Installing files to ${PREFIX}"
mkdir -p "${PREFIX}/bin" "${PREFIX}/web" "${PREFIX}/etc"

install -m 0755 "${STAGE}/bin/server"             "${PREFIX}/bin/server"
# Replace web/ wholesale so removed assets don't linger.
rm -rf "${PREFIX}/web"
mkdir -p "${PREFIX}/web"
cp -r "${STAGE}/web/." "${PREFIX}/web/"
install -m 0644 "${STAGE}/etc/imaginary-storage.service" "${PREFIX}/etc/imaginary-storage.service"
install -m 0644 "${STAGE}/VERSION"                 "${PREFIX}/VERSION"
[ -f "${STAGE}/README.md" ] \
  && install -m 0644 "${STAGE}/README.md" "${PREFIX}/README.md" || true

# ---- config + data dirs -------------------------------------------------
mkdir -p "${CONFIG_DIR}" "${DATA_DIR}/sessions"
chmod 0700 "${DATA_DIR}/sessions" || true

CONFIG_FILE="${CONFIG_DIR}/config.env"
if [ ! -f "${CONFIG_FILE}" ]; then
  info "Writing ${CONFIG_FILE}"
  cat > "${CONFIG_FILE}" <<EOF
# Imaginary Storage NAS — service configuration.
# Edit and 'systemctl restart imaginary-storage' to apply.

IMAGINARY_PORT=${PORT}
IMAGINARY_WEB_ROOT=${PREFIX}/web
IMAGINARY_DATA_DIR=${DATA_DIR}

# Optional TLS (uncomment + restart to enable HTTPS)
# IMAGINARY_TLS_CERT=/etc/imaginary-storage/tls.crt
# IMAGINARY_TLS_KEY=/etc/imaginary-storage/tls.key
EOF
  chmod 0644 "${CONFIG_FILE}"
else
  ok "Existing config preserved at ${CONFIG_FILE}"
fi

# ---- systemd unit -------------------------------------------------------
info "Installing systemd unit at ${UNIT_FILE}"
install -m 0644 "${PREFIX}/etc/imaginary-storage.service" "${UNIT_FILE}"
systemctl daemon-reload

if [ "$NO_START" -eq 1 ]; then
  ok "${ACTION} complete. Service not started (--no-start)."
  exit 0
fi

info "Enabling and starting ${SERVICE_NAME}"
systemctl enable --now "${SERVICE_NAME}"

# Give it a moment to settle so the success line below is meaningful.
sleep 1
if systemctl is-active --quiet "${SERVICE_NAME}"; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  [ -z "$IP" ] && IP="localhost"
  PORT_RUNNING=$(grep -E '^IMAGINARY_PORT=' "${CONFIG_FILE}" | cut -d= -f2 || echo "$PORT")
  printf '\n'
  ok "${ACTION} complete: v${NEW_VERSION} running"
  printf '   URL:   http://%s:%s\n' "$IP" "$PORT_RUNNING"
  printf '   Logs:  journalctl -u %s -f\n' "$SERVICE_NAME"
  printf '   Stop:  systemctl stop %s\n' "$SERVICE_NAME"
else
  warn "service failed to start; recent logs:"
  journalctl -u "${SERVICE_NAME}" --no-pager -n 20 || true
  exit 1
fi
