# BolPrompt

BolPrompt turns Hindi, English, or Hinglish speech into concise, structured prompts for coding agents.

## Features

- Records from the browser microphone.
- Transcribes multilingual speech using Groq Whisper.
- Compiles the transcript with Gemini or Groq.
- Uses Groq as the reliable default and automatically fails over between Groq and Gemini when either provider is temporarily overloaded or rate-limited.
- Supports Quick, Standard, and Detailed output modes.
- Accepts optional project context without requiring repository access.
- Estimates output tokens and copies the final prompt to the clipboard.
- Keeps API keys in browser memory only. They are never persisted by the app.

## Requirements

- Node.js 18.17 or newer.
- A Groq API key for speech transcription.
- A Gemini API key for the default prompt compiler, or use Groq for both steps.

Both providers offer free tiers, but their quotas and data policies can change. BolPrompt never enables billing or upgrades a provider account.

## Run locally

```bash
npm start
```

Copy the environment template and add your keys:

```bash
cp .env.example .env
```

Edit `.env`, then start the app and open <http://127.0.0.1:4173>.

The server intentionally binds only to `127.0.0.1`. Keys are accepted only from `.env`, remain server-side, and are never returned to the browser. They are not logged, cached, placed in URLs, or sent through frontend request headers. Keep `.env` private; it is excluded by `.gitignore`.

## Check the source

```bash
npm run check
```

## Free/private alternatives

The provider boundary is isolated in `server.mjs`, so a future offline adapter can use `faster-whisper` or `whisper.cpp` for transcription and Ollama for prompt compilation.
