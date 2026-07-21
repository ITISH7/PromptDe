# PromptDe

PromptDe turns spoken or typed Hindi, English, and Hinglish ideas into structured English prompts for coding agents. It can run as a local web application or as an Electron desktop utility with global keyboard shortcuts.

## Features

- Transcribes microphone recordings with Groq Whisper.
- Compiles transcripts with Gemini or Groq into concise, structured prompts.
- Supports Quick, Standard, and Detailed output modes.
- Accepts optional project context and produces a separate English interpretation.
- Copies the generated prompt to the clipboard.
- Runs from the desktop tray on Linux and Windows.
- Keeps desktop API keys in a local owner-readable configuration file; browser-entered keys last only for the current tab session.

## Technology

PromptDe uses Node.js ES modules and the built-in HTTP server for its backend, plain HTML/CSS/JavaScript for its browser interface, and Electron for its desktop shell. Dependencies and scripts are managed with npm.

## Prerequisites

Before starting, install or obtain:

- [Node.js](https://nodejs.org/) 18.17 or newer, including npm.
- A microphone and permission to use it if you want speech input.
- A [Groq API key](https://console.groq.com/keys) for speech transcription.
- A [Gemini API key](https://aistudio.google.com/app/apikey) if you want to use the default Gemini prompt compiler. Alternatively, Groq can handle both transcription and prompt compilation.

No API keys are needed to run the automated tests.

## Installation

1. Clone the repository and enter it:

   ```bash
   git clone https://github.com/ITISH7/PromptDe.git
   cd PromptDe
   ```

2. Install the exact dependency versions recorded in `package-lock.json`:

   ```bash
   npm ci
   ```

   Use `npm install` instead when intentionally updating dependencies.

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
   ```

`GROQ_API_KEY` is required for recording. `GEMINI_API_KEY` is required only when Gemini is selected for compilation. `PORT` is optional and defaults to `4173` for the web server. If both provider keys are present, PromptDe can fail over to the other provider after a temporary compiler error.

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

Press the recording shortcut a second time to stop recording and continue the workflow.

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
```

Create a Windows NSIS installer (normally on Windows or a configured cross-build host):

```bash
npm run pack:windows
```

Create a portable Windows ZIP:

```bash
npm run pack:windows:portable
```

Generated packages are written to `dist/`. The release build workflow creates native Linux and Windows artifacts for version tags. The CI workflow installs dependencies, validates syntax, and runs tests for pushes and pull requests targeting `main`.

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
