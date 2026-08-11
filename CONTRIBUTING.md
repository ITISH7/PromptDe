# Contributing to PromptDe

Thank you for helping improve PromptDe. Contributions can include bug reports, documentation, translations, design feedback, tests, and code.

## Before you begin

- Read and follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues before opening a new one.
- Use GitHub's private security reporting for vulnerabilities. Do not open a public security issue.
- Never include API keys, private transcripts, clipboard contents, or other sensitive data in an issue, screenshot, recording, commit, or test fixture.

Small bug fixes and documentation improvements can go directly to a pull request. For a large feature or behavior change, open a feature request first so the approach can be discussed.

## Development setup

You need Node.js 22.12 or newer and npm. Provider keys are not required for linting or automated tests.

```bash
git clone https://github.com/ITISH7/PromptDe.git
cd PromptDe
npm ci
npm run lint
npm test
```

Run the browser app with `npm start` or the Electron app with `npm run desktop`. Copy `.env.example` to `.env` only when you need to test a real provider request.

Linux desktop shortcut development also requires the X11 or Wayland helpers listed in the [README](README.md#install-from-source).

## Making a change

1. Create a focused branch from `master`, such as `fix/wayland-paste` or `docs/install-guide`.
2. Keep the change limited to one concern.
3. Match the existing style: ES modules, two-space indentation, semicolons, and clear user-facing error messages.
4. Add or update tests when behavior changes.
5. Run the required checks:

   ```bash
   npm run lint
   npm test
   ```

6. For interface changes, test both a narrow and wide window and attach before/after screenshots to the pull request.
7. Update `README.md` or `CHANGELOG.md` when users need to know about the change.

## Commit and pull-request guidance

Use short, descriptive commits. The repository commonly uses prefixes such as:

- `feat:` for user-facing functionality
- `fix:` for a bug fix
- `docs:` for documentation
- `test:` for test-only changes
- `chore:` for maintenance

Pull requests should explain the problem, the chosen solution, how it was tested, and any platform-specific behavior. Keep generated packages and local configuration out of commits; `dist/` and `.env` are intentionally ignored.

By contributing, you agree that your contribution will be licensed under PromptDe's [MIT License](LICENSE).
