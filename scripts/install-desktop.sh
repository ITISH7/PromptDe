#!/bin/sh
set -eu

repo="${PROMPTDE_REPOSITORY:-ITISH7/PromptDe}"
api_url="https://api.github.com/repos/${repo}/releases/latest"

case "$(uname -s)" in
  Linux) ;;
  *)
    echo "This installer is for Linux. On Windows, run scripts/install-desktop.ps1 in PowerShell." >&2
    exit 1
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) ;;
  *)
    echo "PromptDe currently publishes desktop builds for 64-bit Intel/AMD Linux only." >&2
    exit 1
    ;;
esac

run_as_admin() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    echo "Administrator access is required to install PromptDe's Linux shortcut helpers." >&2
    echo "Install sudo or run this installer as root, then try again." >&2
    return 1
  fi
}

has_desktop_portal() {
  command -v xdg-desktop-portal >/dev/null 2>&1 ||
    [ -x /usr/libexec/xdg-desktop-portal ] ||
    [ -x /usr/lib/xdg-desktop-portal ]
}

install_shortcut_dependencies() {
  if [ "${PROMPTDE_SKIP_SYSTEM_DEPENDENCIES:-0}" = "1" ]; then
    echo "Skipping Linux shortcut dependency installation (PROMPTDE_SKIP_SYSTEM_DEPENDENCIES=1)."
    return
  fi

  session_type="$(printf '%s' "${XDG_SESSION_TYPE:-}" | tr '[:upper:]' '[:lower:]')"
  if [ "$session_type" = "wayland" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; then
    dependency_names=""
    command -v wtype >/dev/null 2>&1 || dependency_names="wtype"
    has_desktop_portal || dependency_names="${dependency_names}${dependency_names:+ }xdg-desktop-portal"
    session_name="Wayland"
  else
    dependency_names=""
    command -v xdotool >/dev/null 2>&1 || dependency_names="xdotool"
    command -v xprop >/dev/null 2>&1 || dependency_names="${dependency_names}${dependency_names:+ }xprop"
    session_name="X11"
  fi

  if [ -z "$dependency_names" ]; then
    echo "PromptDe shortcut helpers are already installed for ${session_name}; skipping dependency installation."
    return
  fi

  echo "Installing missing PromptDe ${session_name} shortcut dependencies: ${dependency_names}"
  if command -v apt-get >/dev/null 2>&1; then
    if [ "$session_name" = "Wayland" ]; then
      packages="wtype xdg-desktop-portal"
    else
      packages="xdotool x11-utils"
    fi
    run_as_admin apt-get install -y $packages
  elif command -v dnf >/dev/null 2>&1; then
    if [ "$session_name" = "Wayland" ]; then
      packages="wtype xdg-desktop-portal"
    else
      packages="xdotool xorg-x11-utils"
    fi
    run_as_admin dnf install -y $packages
  elif command -v pacman >/dev/null 2>&1; then
    if [ "$session_name" = "Wayland" ]; then
      packages="wtype xdg-desktop-portal"
    else
      packages="xdotool xorg-xprop"
    fi
    run_as_admin pacman -S --needed --noconfirm $packages
  elif command -v zypper >/dev/null 2>&1; then
    if [ "$session_name" = "Wayland" ]; then
      packages="wtype xdg-desktop-portal"
    else
      packages="xdotool xprop"
    fi
    run_as_admin zypper --non-interactive install $packages
  else
    echo "Could not install ${dependency_names}: no supported package manager was found." >&2
    echo "Install those packages with your system package manager, then run this installer again." >&2
    exit 1
  fi

  if [ "$session_name" = "Wayland" ]; then
    command -v wtype >/dev/null 2>&1 && has_desktop_portal || {
      echo "Wayland shortcut dependencies were not installed successfully." >&2
      exit 1
    }
  else
    command -v xdotool >/dev/null 2>&1 && command -v xprop >/dev/null 2>&1 || {
      echo "X11 shortcut dependencies were not installed successfully." >&2
      exit 1
    }
  fi
}

install_shortcut_dependencies

if command -v curl >/dev/null 2>&1; then
  fetch() { curl -fsSL "$1"; }
  download() { curl -fL --progress-bar "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
  fetch() { wget -qO- "$1"; }
  download() { wget -O "$2" "$1"; }
else
  echo "Install curl or wget, then run this installer again." >&2
  exit 1
fi

release_json="$(fetch "$api_url")"
asset_url="$(printf '%s\n' "$release_json" |
  sed -n 's/.*"browser_download_url":[[:space:]]*"\([^"]*\.AppImage\)".*/\1/p' |
  head -n 1)"
tag="$(printf '%s\n' "$release_json" |
  sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' |
  head -n 1)"

if [ -z "$asset_url" ] || [ -z "$tag" ]; then
  echo "The latest GitHub release does not contain a Linux AppImage." >&2
  exit 1
fi

install_dir="${XDG_DATA_HOME:-${HOME}/.local/share}/promptde"
bin_dir="${HOME}/.local/bin"
applications_dir="${XDG_DATA_HOME:-${HOME}/.local/share}/applications"
icon_dir="${XDG_DATA_HOME:-${HOME}/.local/share}/icons/hicolor/512x512/apps"
app_image="${install_dir}/PromptDe.AppImage"

mkdir -p "$install_dir" "$bin_dir" "$applications_dir" "$icon_dir"
download "$asset_url" "${app_image}.download"
chmod 755 "${app_image}.download"
mv "${app_image}.download" "$app_image"

icon_url="https://raw.githubusercontent.com/${repo}/${tag}/assets/icon.png"
download "$icon_url" "${icon_dir}/promptde.png"

launcher="${bin_dir}/promptde"
{
  printf '%s\n' '#!/bin/sh'
  printf '%s\n' 'unset ELECTRON_RUN_AS_NODE ELECTRON_NO_ATTACH_CONSOLE'
  printf '%s\n' 'unset GIO_MODULE_DIR GTK_EXE_PREFIX GTK_IM_MODULE_FILE GTK_PATH'
  printf '%s\n' 'export APPIMAGE_EXTRACT_AND_RUN="${APPIMAGE_EXTRACT_AND_RUN:-1}"'
  printf 'exec "%s" --class=promptde "$@"\n' "$app_image"
} > "${launcher}.download"
chmod 755 "${launcher}.download"
mv "${launcher}.download" "$launcher"

desktop_file="${applications_dir}/promptde.desktop"
{
  printf '%s\n' '[Desktop Entry]'
  printf '%s\n' 'Name=PromptDe'
  printf '%s\n' 'GenericName=Voice Prompt Compiler'
  printf '%s\n' 'Comment=Turn Hindi, English, or Hinglish speech into agent-ready prompts'
  printf 'Exec="%s"\n' "$launcher"
  printf '%s\n' 'Icon=promptde'
  printf '%s\n' 'Terminal=false'
  printf '%s\n' 'Type=Application'
  printf '%s\n' 'Categories=Utility;'
  printf '%s\n' 'StartupNotify=true'
  printf '%s\n' 'StartupWMClass=promptde'
} > "${desktop_file}.download"
mv "${desktop_file}.download" "$desktop_file"

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$applications_dir" >/dev/null 2>&1 || true
fi

echo "PromptDe ${tag} is installed. Open PromptDe from the application menu or run: ${launcher}"
