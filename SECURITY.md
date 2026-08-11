# Security Policy

PromptDe handles microphone recordings, clipboard content, global shortcuts, and user-supplied provider keys. Please report security problems privately and avoid exposing sensitive information in public issues.

## Supported versions

| Version | Supported |
| --- | --- |
| Latest GitHub release | Yes |
| Older releases | No |

Upgrade to the latest release before reporting an issue that may already have been fixed.

## Report a vulnerability

Use [GitHub's private vulnerability reporting form](https://github.com/ITISH7/PromptDe/security/advisories/new).

Include, when possible:

- The affected PromptDe version and operating system
- Whether you use the browser app or desktop app
- Clear reproduction steps or a minimal proof of concept
- The impact and which data or system capability may be exposed
- Any suggested mitigation

Do not include real API keys, private recordings, transcripts, clipboard contents, or unrelated personal data. Replace sensitive values with obvious placeholders.

You should receive an acknowledgement within seven days. The maintainer will investigate, coordinate a fix and release when needed, and credit the reporter if requested. Please allow time for a fix before publicly disclosing the issue.

## Security expectations

- Browser-entered keys are stored only for the current tab session.
- Desktop keys are saved in PromptDe's local configuration file.
- Audio is sent to Groq for transcription.
- Prompt text is sent to the selected Groq or Gemini compiler.
- `.env` files are excluded from Git and must never be committed.

For non-security bugs, use the regular [issue forms](https://github.com/ITISH7/PromptDe/issues/new/choose).
