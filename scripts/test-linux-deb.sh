#!/bin/sh
set -eu

if ! command -v docker >/dev/null 2>&1 && ! command -v podman >/dev/null 2>&1; then
  echo "Docker or Podman is required to test the Debian package in a clean container." >&2
  exit 1
fi

package_version="$(node -p "require('./package.json').version")"
deb_path="dist/promptde_${package_version}_amd64.deb"
if [ ! -f "$deb_path" ]; then
  echo "No Debian package found at ${deb_path}. Run npm run pack:linux first." >&2
  exit 1
fi

case "$deb_path" in
  /*) ;;
  *) deb_path="$(pwd)/$deb_path" ;;
esac

if command -v docker >/dev/null 2>&1; then
  container_runtime="docker"
else
  container_runtime="podman"
fi

"$container_runtime" run --rm \
  --volume "$deb_path:/tmp/promptde.deb:ro" \
  ubuntu:22.04 \
  sh -c 'apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y /tmp/promptde.deb && command -v xdotool && command -v xprop && command -v wtype && test -x /usr/libexec/xdg-desktop-portal'

echo "PromptDe Debian package and Linux shortcut dependencies installed successfully."
