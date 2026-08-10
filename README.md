# PromptDe

PromptDe turns spoken or typed Hindi, English, and Hinglish ideas into structured English prompts for coding agents. It can run as a local web application or as an Electron desktop utility with global keyboard shortcuts.

## Features

- Transcribes microphone recordings with Groq Whisper.
- Compiles transcripts with Groq by default or Gemini when selected.
- Translates speech into natural, formal, or informal English/Hindi and pastes it at the active cursor.
- Translates text selected in any application to English and replaces it in place.
- Converts selected text into Quick, Standard, or Detailed prompts and replaces it in place.
- Supports Quick, Standard, and Detailed output modes.
- Accepts optional project context and produces a separate English interpretation.
- Copies the generated prompt to the clipboard.
- Runs from the desktop tray on Linux and Windows.
- Keeps desktop API keys in a local owner-readable configuration file; browser-entered keys last only for the current tab session.

## Technology

PromptDe uses Node.js ES modules and the built-in HTTP server for its backend, plain HTML/CSS/JavaScript for its browser interface, and Electron for its desktop shell. Dependencies and scripts are managed with npm.

## Prerequisites

Before starting, install or obtain:

- [Node.js](https://nodejs.org/) 22.12 or newer, including npm.
- A microphone and permission to use it if you want speech input.
- A [Groq API key](https://console.groq.com/keys) for speech transcription.
- A [Gemini API key](https://aistudio.google.com/app/apikey) if you want to use the default Gemini prompt compiler. Alternatively, Groq can handle both transcription and prompt compilation.
- On Linux, PromptDe uses `xdotool` and `xprop` on X11, or `wtype` and `xdg-desktop-portal` on Wayland, for its global shortcut workflows. The Debian package declares them as dependencies, and the AppImage installer detects the active display system and installs only missing helpers.

No API keys are needed to run the automated tests.

For source installations on Debian/Ubuntu, install the helpers with `sudo apt install xdotool x11-utils` on X11 or `sudo apt install wtype xdg-desktop-portal` on Wayland. Generated text still falls back to the clipboard if a compositor prevents automatic paste.

## Installation

### Install the desktop app directly

Linux (64-bit Intel/AMD; the app is installed per-user, while missing system helpers may require administrator access):

```bash
curl -fsSL https://github.com/ITISH7/PromptDe/releases/latest/download/install-promptde-linux.sh | sh
```

The Linux installer detects the operating system and architecture, downloads the
latest AppImage, and adds PromptDe to the current user's application menu. It
uses AppImage extraction mode so installation does not depend on FUSE. Before
downloading PromptDe, it checks the active X11 or Wayland session and skips
shortcut helpers that are already installed. Missing helpers are installed with
`apt`, `dnf`, `pacman`, or `zypper`; this may request administrator access. Set
`PROMPTDE_SKIP_SYSTEM_DEPENDENCIES=1` only when managing those packages yourself.

Windows (64-bit, Windows 10 or newer):

Download and open the installer:

[Download PromptDe for Windows](https://github.com/ITISH7/PromptDe/releases/latest/download/PromptDe-Setup-x64.exe)

No Node.js, npm, Git, or PowerShell is required on the destination computer.
The PowerShell downloader below is an optional alternative:

```powershell
$script = "$env:TEMP\install-promptde.ps1"
Invoke-WebRequest -UseBasicParsing https://raw.githubusercontent.com/ITISH7/PromptDe/HEAD/scripts/install-desktop.ps1 -OutFile $script
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script
```

The Windows script downloads and starts the latest published NSIS installer.
It supports Windows PowerShell 5.1 and modern PowerShell, installs per user
without administrator access, and creates Start menu and desktop shortcuts.

If PromptDe cannot load its interface, it now shows a startup error instead of
leaving a blank window. Diagnostic details are written to
`%APPDATA%\PromptDe\startup.log`.

macOS:

- [Apple Silicon (M1/M2/M3/M4 and newer)](https://github.com/ITISH7/PromptDe/releases/latest/download/PromptDe-mac-arm64.dmg)
- [Intel Mac](https://github.com/ITISH7/PromptDe/releases/latest/download/PromptDe-mac-x64.dmg)

Open the downloaded DMG and drag PromptDe into Applications. These initial Mac
builds are not notarized, so on first launch control-click PromptDe, choose
**Open**, and confirm. Node.js, npm, and Git are not required on the Mac.

The installer scripts stop with a clear message on unsupported systems.

Tagged builds are published as permanent GitHub Release assets so these
installers do not depend on expiring GitHub Actions artifacts.
For a warning-free Windows installation, configure the repository secrets
`WINDOWS_CSC_LINK` and `WINDOWS_CSC_KEY_PASSWORD` with a trusted code-signing
certificate. Unsigned development builds can trigger Microsoft Defender
SmartScreen.

### Install from source

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/ITISH7/PromptDe.git
   cd PromptDe
   ```

2. Install the exact dependency versions recorded in `package-lock.json`:

   ```bash
   node --version
   npm ci
   ```

   The Node version must be 22.12 or newer. If you use `nvm`, run `nvm use`
   first; the included `.nvmrc` selects Node 22. Use `npm install` instead when
   intentionally updating dependencies.

## Configuration

PromptDe supports two ways to provide API keys.

### Environment file

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

   In PowerShell, use `Copy-Item .env.example .env`.

2. Edit `.env`:

   ```dotenv
   GROQ_API_KEY=gsk_your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=4173
   PROMPTDE_TRANSLATE_PASTE_SHORTCUT=CommandOrControl+F9
   PROMPTDE_QUICK_PROMPT_PASTE_SHORTCUT=Shift+F1
   PROMPTDE_STANDARD_PROMPT_PASTE_SHORTCUT=Shift+F2
   PROMPTDE_DETAILED_PROMPT_PASTE_SHORTCUT=Shift+F3
   PROMPTDE_SELECTED_TRANSLATE_SHORTCUT=CommandOrControl+Shift+F5
   PROMPTDE_SELECTED_QUICK_PROMPT_SHORTCUT=CommandOrControl+Shift+F6
   PROMPTDE_SELECTED_STANDARD_PROMPT_SHORTCUT=CommandOrControl+Shift+F7
   PROMPTDE_SELECTED_DETAILED_PROMPT_SHORTCUT=CommandOrControl+Shift+F8
   ```

`GROQ_API_KEY` is required for recording and is also the default prompt compiler
key. `GEMINI_API_KEY` is optional and required only when Gemini is explicitly
selected for compilation or translation. If the selected provider has no key,
PromptDe automatically uses the configured provider. `PORT` is optional and
defaults to `4173` for the web server. The `PROMPTDE_*_SHORTCUT` values optionally
change the corresponding desktop shortcuts. If both provider keys are present,
PromptDe can fail over to the other provider after a temporary compiler error.

The repository ignores `.env`; never commit real credentials.

### Settings in the application

Open **Settings** and enter the provider keys there instead of, or in addition to, using `.env`.

- In the web application, keys are stored in browser session storage and cleared when the tab is closed. They are sent only with provider requests and are not persisted by the server.
- In the desktop application, keys are written to PromptDe's local configuration `.env`. Use **Settings → Open configuration folder** to locate it. Saved values are not read back into the page.

## Run locally

### Web application

Start the local server:

```bash
npm start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173) unless you changed `PORT`. Allow microphone access when prompted. You can also type or paste a transcript without granting microphone access.

Stop the server with `Ctrl+C`.

### Desktop application

Start the Electron application in development mode:

```bash
npm run desktop
```

The desktop shell starts its own local server on an available port. Closing the window hides it in the system tray; use the tray menu to quit it completely.

Global shortcuts while the desktop application is running:

| Action | Windows/Linux | macOS equivalent |
| --- | --- | --- |
| Show, record, and compile | `Ctrl+Shift+Space` | `Cmd+Shift+Space` |
| Clear the transcript | `Ctrl+Shift+Backspace` | `Cmd+Shift+Backspace` |
| Record project context | `Ctrl+Alt+C` | `Cmd+Option+C` |
| Copy the English translation | `Ctrl+Alt+E` | `Cmd+Option+E` |
| Copy the compiled prompt | `Ctrl+Alt+P` | `Cmd+Option+P` |
| Record, translate, and paste | `Ctrl+F9` | `Cmd+F9` |
| Record a quick prompt and paste | `Shift+F1` | `Shift+F1` |
| Record a standard prompt and paste | `Shift+F2` | `Shift+F2` |
| Record a detailed prompt and paste | `Shift+F3` | `Shift+F3` |
| Translate selected text to English | `Ctrl+Shift+F5` | `Cmd+Shift+F5` |
| Convert selected text to a quick prompt | `Ctrl+Shift+F6` | `Cmd+Shift+F6` |
| Convert selected text to a standard prompt | `Ctrl+Shift+F7` | `Cmd+Shift+F7` |
| Convert selected text to a detailed prompt | `Ctrl+Shift+F8` | `Cmd+Shift+F8` |

Press the recording shortcut a second time to stop recording and continue the workflow.

For prompt-and-paste mode, place the cursor in another application and press `Shift+F1`, `Shift+F2`, or `Shift+F3`. Press the same shortcut again after speaking. PromptDe transcribes the new recording, compiles it at the selected detail level, and pastes the generated prompt at the active cursor.

For translation mode, choose the target language and conversation style under **Settings → Translate & paste**. Place the cursor in another application, press the shortcut once, speak, and press it again. PromptDe translates the recording and pastes the result without opening its window. If automatic paste is unavailable, the translation remains on the clipboard so it can be pasted manually.

For selected-text actions, highlight text in any editable application and press `Ctrl+Shift+F5`, `Ctrl+Shift+F6`, `Ctrl+Shift+F7`, or `Ctrl+Shift+F8`. PromptDe copies the selection, processes it in the background, and pastes the result over the highlighted text. Translation always targets natural English; the other three shortcuts choose the prompt detail level. On macOS, use `Cmd` instead of `Ctrl`.

## Linting and tests

Run the project's syntax validation across the server, browser, desktop, and test JavaScript files:

```bash
npm run lint
```

Run the server integration tests with Node's built-in test runner:

```bash
npm test
```

The tests start the server on an ephemeral local port and do not call Groq or Gemini.

## Build desktop packages

Create Linux AppImage and Debian packages:

```bash
npm run pack:linux
sudo apt install ./dist/promptde_0.1.8_amd64.deb
```

Using `apt install` for the local package installs PromptDe's required native
libraries and its X11/Wayland shortcut helpers, while automatically skipping
packages already present. Run `npm run test:deb`
after packaging to verify the `.deb` in a clean Ubuntu X11 container.

Create a Windows NSIS installer (normally on Windows or a configured cross-build host):

```bash
npm run pack:windows
```

Create a portable Windows ZIP:

```bash
npm run pack:windows:portable
```

Create Intel and Apple Silicon macOS DMGs (must run on macOS after generating
`build/icon.icns`, which GitHub Actions does automatically):

```bash
npm run pack:mac
```

Generated packages are written to `dist/`. The release build workflow creates
native Linux, Windows, and macOS artifacts for version tags. The CI workflow
installs dependencies, validates syntax, and runs tests for pushes and pull
requests targeting `main`.

## Project structure

```text
.
├── desktop/                 Electron main process, launcher, and preload bridge
├── public/                  Browser interface
├── test/                    Node integration tests
├── .github/workflows/       CI and desktop packaging workflows
├── server.mjs               HTTP server and provider integrations
└── package.json             npm scripts and packaging configuration
```
