#!/usr/bin/env bash
# Deploy this repo to the Pi and restart the service.
#   1. rsync to a staging dir in the user's home (no root needed)
#   2. over one interactive ssh session, sudo-rsync staging → /opt/led-matrix
#      and restart led-matrix (sudo can prompt for a password here)
# Usage: ./deploy.sh [extra rsync args]   e.g. ./deploy.sh --dry-run
set -euo pipefail

REMOTE=bertrand@piled.smittn.com
STAGING_DIR=/home/bertrand/pi-dashboard
INSTALL_DIR=/opt/led-matrix
SERVICE=led-matrix

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Runtime state on the Pi (venv, config, Spotify token, uploaded images) is
# excluded so a deploy never overwrites or deletes it.
EXCLUDES=(
  --exclude '.git/'
  --exclude '.vscode/'
  --exclude '.DS_Store'
  --exclude '__pycache__/'
  --exclude '*.pyc'
  --exclude 'venv/'
  --exclude 'reference/'
  --exclude '3D_files/'
  --exclude 'config.json'
  --exclude '.spotify_token_cache'
  --exclude 'static/library/'
  --exclude 'static/matrix_image.png'
  --exclude 'static/matrix_image.gif'
  --exclude 'kinect_background*.npy'
)

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in -n|--dry-run) DRY_RUN=1 ;; esac
done

echo "==> Syncing to $REMOTE:$STAGING_DIR"
rsync -avz "${EXCLUDES[@]}" "$@" "$SCRIPT_DIR/" "$REMOTE:$STAGING_DIR/"

if [ "$DRY_RUN" = 1 ]; then
  echo "==> Dry run: skipping install to $INSTALL_DIR and service restart"
  exit 0
fi

# Quote the excludes so they survive the remote shell.
REMOTE_EXCLUDES=$(printf '%q ' "${EXCLUDES[@]}")

echo "==> Installing to $INSTALL_DIR and restarting $SERVICE"
ssh -t "$REMOTE" "
  set -e
  sudo rsync -a --chown=root:root $REMOTE_EXCLUDES '$STAGING_DIR/' '$INSTALL_DIR/'
  sudo chmod +x '$INSTALL_DIR/wait-for-network.sh'
  sudo install -m 644 '$INSTALL_DIR/kinect-depth.conf' /etc/modprobe.d/kinect-depth.conf
  if [ \"\$(cat /sys/module/gspca_kinect/parameters/depth_mode 2>/dev/null)\" = N ]; then
    echo '==> Reloading gspca_kinect in depth mode'
    sudo systemctl stop '$SERVICE'
    sudo modprobe -r gspca_kinect && sudo modprobe gspca_kinect
  fi
  sudo systemctl restart '$SERVICE'
  sleep 2
  systemctl --no-pager --lines=0 status '$SERVICE' || true
"
