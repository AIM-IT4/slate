# Security policy

## Report a vulnerability privately

Do not post working credentials, private files, or exploit details in a public issue.

Use this repository's **Security → Report a vulnerability** option when it is available. If that option is unavailable, open a minimal issue titled **Private security contact requested** without sensitive details; a maintainer can arrange a private channel before you share the report.

Include the affected version or commit, impact, and the smallest reproduction you can provide safely. Redact provider keys, MCP headers, signed file URLs, chat content, and identifying information.

## Support status

Slate is an early preview. Fixes target the current `main` branch and the latest preview build; older builds do not have a separate maintenance guarantee. There is no promised security response time or completed independent security audit.

## Security model

Provider credentials and MCP request headers use native secure storage, with opaque references in the application database. Supported backups omit those credentials. This reduces accidental exposure; it does not make a rooted device, compromised app, or malicious connected tool safe.

A remote execution server can run commands on its host. Use a dedicated, isolated workspace; configure authentication and HTTPS; and limit which tools an agent can access. Do not expose the execution service as an unauthenticated public shell.

See [Privacy and data flow](docs/slate/privacy.md) and [Slate technical notes](SLATE.md#security-changes) for current behavior and known limits.

## Contributing security fixes

Keep reproduction credentials synthetic, add a regression test at the owning boundary, and preserve the public error contract. Signing keys, production service tokens, personal data, and local credential files must never be committed.
