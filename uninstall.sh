#!/usr/bin/env bash
#
# uninstall.sh — remove Imaginary Storage NAS.
#
# By default removes the binary, web bundle, and systemd unit but
# preserves /etc/imaginary-storage and /var/lib/imaginary-storage.
# Per-user ~/.imaginary/ data is NEVER touched — users own their data.
#
# Flags:
#   --purge       Also remove /etc/imaginary-storage and /var/lib/imaginary-storage
#   --yes / -y    Skip confirmation prompts
#   --help / -h

set -euo pipefail

PREFIX="/opt/imaginary-storage"
CONFIG_DIR="/etc/imaginary-storage"
DATA_DIR="/var/lib/imaginary-storage"
SERVICE_NAME="imaginary-storage"
UNIT_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

PURGE=0
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

print_help() { sed -n '3,13p' "$0" | sed 's/^# \{0,1\}//'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --purge)    PURGE=1; shift ;;
    --yes|-y)   ASSUME_YES=1; shift ;;
    --help|-h)  print_help; exit 0 ;;
    *)          die "unknown argument: $1" ;;
  esac
done

confirm() {
  [ "$ASSUME_YES" -eq 1 ] && return 0
  local prompt="$1"
  read -r -p "$prompt [y/N] " reply
  case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

[ "$(id -u)" -eq 0 ] || die "must run as root (try: sudo $0)"

if confirm "Uninstall ${SERVICE_NAME}? Config and data are kept unless --purge."; then :; else
  die "aborted"
fi

if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${SERVICE_NAME}\.service"; then
  info "Disabling and stopping ${SERVICE_NAME}"
  systemctl disable --now "${SERVICE_NAME}" 2>/dev/null || true
fi

if [ -f "${UNIT_FILE}" ]; then
  info "Removing ${UNIT_FILE}"
  rm -f "${UNIT_FILE}"
  systemctl daemon-reload
fi

if [ -d "${PREFIX}" ]; then
  info "Removing ${PREFIX}"
  rm -rf "${PREFIX}"
fi

if [ "$PURGE" -eq 1 ]; then
  warn "Purge mode: removing config and data"
  if confirm "Delete ${CONFIG_DIR} and ${DATA_DIR}?"; then
    rm -rf "${CONFIG_DIR}" "${DATA_DIR}"
    ok "Config and data removed."
  fi
else
  [ -d "${CONFIG_DIR}" ] && info "Kept ${CONFIG_DIR} (pass --purge to remove)"
  [ -d "${DATA_DIR}"   ] && info "Kept ${DATA_DIR} (pass --purge to remove)"
fi

ok "Uninstalled."
printf '   Per-user data under ~/.imaginary/ is untouched (each user owns theirs).\n'
