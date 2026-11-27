# Privacy and data flow

Slate is a client for services you configure. Bringing your own key gives you control over provider selection; it does not make cloud inference local.

| Data or action | Where it goes |
| --- | --- |
| Chat messages and supported attachments sent to a model | Your selected model provider |
| Provider keys and MCP authorization headers at rest | Device-bound native secure storage; the database keeps opaque references |
| Conversations, attachment metadata, and usage records | Application-managed device storage |
| MCP requests and tool arguments | The remote MCP server enabled for that agent |
| Commands and workspace files | The connected execution host |
| Original video for frame sampling | The currently integrated Slate Execution frame service |
| Speech transcription in the video attachment path | Runs on the phone with bundled Whisper model assets; the prepared transcript can then be sent to the selected model |
| An external playback or download URL | The server hosting that URL |

## Current hardening

The fork disables upstream product analytics, Sentry, Observe, Insights, and the upstream Expo update channel. Supported snapshot exports omit provider credentials and MCP authorization headers. Android system backups and cleartext provider connections are disabled in the maintained build configuration. See [technical notes](../../SLATE.md#security-changes) for details and limits.

These are implementation choices, not a completed independent privacy or network audit. The app, device, model provider, execution host, and connected tools are separate trust boundaries. Some inherited features and dependencies still need further review.

## Credentials and backups

Back up your content deliberately and reconnect credentials after a restore. Obsolete secure-store references are not currently garbage-collected; revoke old keys with the provider when they are no longer needed. A screenshot or exported log can still reveal a credential if you place it in ordinary text.

## Connected tools and retention

Send only the information a tool needs. A command-capable server has access to its own workspace and network, and a third-party service has its own retention policy. This repository does not promise that an execution host keeps files indefinitely. Download valuable artifacts and maintain your source in version control.

Use [the security policy](../../SECURITY.md) for vulnerabilities. Never attach real API keys, authentication headers, signed file links, private videos, or unredacted conversation exports to a public issue.
