# Contributing to Slate

Thanks for helping make AI workflows useful on a phone. Small, well-scoped contributions are welcome.

## Find a starting point

- Reproduce a bug on an Android device and describe the steps precisely.
- Improve setup instructions for a provider or remote MCP server.
- Check accessibility, large text, light and dark themes, or Reduce Motion.
- Help verify media attachments and device codec differences.
- Propose a focused improvement from the [roadmap](ROADMAP.md).

Search [existing issues](https://github.com/AIM-IT4/slate/issues) before opening a new one. Discuss substantial architecture or dependency changes in an issue first. Never include API keys, MCP authorization headers, signing files, or private conversations.

## Set up

Use Node.js 24 and pnpm 12.2.1, then follow [Getting started](README.md#build-from-source) and the fork-specific [build notes](SLATE.md#build). Expo Go cannot run the app's custom native modules. You do not need the maintainer's signing key to contribute.

Run one dependency installation at a time. Preserve the patches in `pnpm-workspace.yaml`; do not use `pnpm rebuild`. The [development guide](docs/guides/development.md#dependencies) explains why.

## Make a change

1. Create a focused branch from `main`.
2. Read [AGENTS.md](AGENTS.md) and the relevant development guide. Frontend, backend, and shared code have explicit ownership boundaries.
3. Keep the change focused. Preserve license notices and upstream attribution.
4. Use existing shared UI controls, theme tokens, motion behavior, and data APIs.
5. Translate changed app copy into every supported locale. Repository documentation is maintained in English.
6. Add a regression check when behavior changes. Avoid tests that only mirror implementation details.

Use a Conventional Commit such as `fix(chat-input): preserve drafts after returning from statistics`.

## Verify

Run the focused behavior suites for your change and the repository gates:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
```

Use [Testing and CI](docs/guides/testing-and-ci.md) for the supported commands and CI boundaries. Do not claim a device result from a type check. For visible changes, include screenshots or a recording from both themes, the device and OS version, and reduced-motion behavior where relevant. If a check is unavailable, say what is inconclusive and why.

## Send a pull request

Open a draft PR against `main`. Explain the problem, the resulting behavior, how it was verified, and any limits. Use the [PR template](.github/pull_request_template.md). Remove credentials and personal data from screenshots, logs, and fixtures before uploading them.

Participation follows the [Code of Conduct](CODE_OF_CONDUCT.md). Security reports follow [SECURITY.md](SECURITY.md), rather than public issue details.
