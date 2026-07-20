# PromptDe Desktop

PromptDe is a Windows and Linux desktop utility that turns Hindi, English, or Hinglish speech into concise, structured English prompts for coding agents.

Repository: [github.com/ITISH7/PromptDe](https://github.com/ITISH7/PromptDe)

## Features

- Runs from the desktop tray and activates globally with `Ctrl+Shift+Space`.
- Records from the system microphone and automatically completes the workflow when activated by the shortcut.
- Transcribes multilingual speech using Groq Whisper.
- Produces an explicit English translation/interpretation.
- Compiles the translated intent with Gemini, with automatic Groq failover when either provider is temporarily overloaded or rate-limited.
- Supports Quick, Standard, and Detailed output modes.
- Accepts optional project context without requiring repository access.
- Estimates output tokens and copies the final prompt to the clipboard.
- Keeps configured desktop/server API keys in private `.env` storage without exposing saved values to the renderer.
- Lets each user bring their own Groq and Gemini API keys from the Settings drawer.

## Requirements

- Node.js 18.17 or newer for development.
- A Groq API key for speech transcription.
- A Gemini API key for the default prompt compiler, or use Groq for both steps.

Both providers offer free tiers, but their quotas and data policies can change. PromptDe never enables billing or upgrades a provider account.

## Configure API keys

```bash
npm start
```

For development, copy the environment template and add your keys:

```bash
cp .env.example .env
```

For an installed desktop build, open **Settings → Open configuration folder**, edit the generated `.env`, and restart PromptDe.

You can also enter or replace both keys directly in **Settings**. The desktop app writes them to its owner-readable local configuration file and activates them immediately. It never reads saved key values back into the page.

In the web app, keys entered in **Settings** are kept only in browser session storage, sent with provider requests, and never persisted by the PromptDe server. They are cleared when the browser tab is closed.

Keys remain in the local main/server process and are never returned to the renderer. They are not logged, cached, placed in URLs, or sent through frontend request headers. Keep `.env` private; it is excluded by `.gitignore`.

## Run the desktop app

```bash
npm install
npm run desktop
```

Press `Ctrl+Shift+Space` anywhere to show PromptDe and start recording. Press it again to stop, transcribe, translate, and compile automatically. Closing the window keeps PromptDe available in the system tray.

The desktop app also registers these global shortcuts:

- Press `Ctrl+Shift+Backspace` (`Cmd+Shift+Backspace` on macOS) to clear the transcript.
- Press `Ctrl+Alt+C` (`Cmd+Option+C` on macOS) to start recording project context. Press it again to stop and append the transcription to Project Context.
- Press `Ctrl+Alt+E` (`Cmd+Option+E` on macOS) to copy the English translation.
- Press `Ctrl+Alt+P` (`Cmd+Option+P` on macOS) to copy the compiled prompt.

The original browser development server remains available with `npm start`.

## Build installers

Linux AppImage and Debian package:

```bash
npm run pack:linux
```

Windows NSIS installer (normally run on Windows or a configured cross-build machine):

```bash
npm run pack:windows
```

Portable Windows ZIP, which can also be cross-built from Linux:

```bash
npm run pack:windows:portable
```

The included GitHub Actions workflow builds native Linux and Windows artifacts on their respective operating systems.

## Check the source

```bash
npm run check
```

## Free/private alternatives

The provider boundary is isolated in `server.mjs`, so a future offline adapter can use `faster-whisper` or `whisper.cpp` for transcription and Ollama for prompt compilation.
