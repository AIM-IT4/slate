# Get started with Slate

## Install and connect a provider

The current target is an Android ARM64 preview. Use a signed APK asset from [Releases](https://github.com/AIM-IT4/slate/releases) when available, or [build from source](../../SLATE.md#build). A Slate iOS build has not been validated.

Open provider settings, select OpenAI or Anthropic, and enter your own API key. Choose a model available to that key, then return to chat. You do not need a Slate account for this flow. Provider billing and limits still apply.

Keep credentials in the app's credential fields. Do not put keys in agent instructions, messages, issue reports, or screenshots.

## Connect a remote MCP server

1. Open **Tools → MCP → Add server**.
2. Enter the server's name and HTTPS MCP endpoint.
3. Choose the authentication method that the server actually supports. For an API key, use **Request headers** rather than OAuth.
4. Enter each header as `Key=Value`, one per line, without surrounding quotes. For example, `X-API-Key=YOUR_KEY` or `Authorization=Bearer YOUR_KEY`, according to the service's documentation.
5. Save and let Slate discover the tools.
6. Enable the server or selected tools for the agent you use in chat.

A saved server alone does not prove that its tools are enabled for the active agent. Test a small read-only action and inspect its actual result.

### Run code without SSH

Connect an execution-capable MCP server, such as a service you host or trust. Ask the agent to inspect the workspace and run a small command such as `python3 --version`. Commands run on that remote machine; adding MCP does not turn Android's embedded JavaScript sandbox into a local shell.

The bundled server source is under [scripts/slate-execution](../../scripts/slate-execution/README.md). Hosting limits, sleep behavior, installed software, and available CPU or GPU depend on the execution provider. Do not assume a free tier is always on or includes a GPU.

## Video and audio

Supported video links can play inline. For uploaded videos, the current attachment preparation path sends the original video to the Slate Execution frame service, samples visual frames, and generates a speech transcript on the phone using bundled Whisper assets. The model receives those prepared representations; it does not necessarily receive or understand the original video/audio stream.

- The frame service must be reachable and authenticated.
- Phone codecs, file size, model image support, and memory limits can affect preparation.
- Speech timestamps are approximate. Partial or failed transcription should be reported as such.
- Audio level measurements are basic dBFS statistics; they are not an assessment of music, delivery, or professional loudness compliance.
- Connecting another coding MCP server does not replace the currently fixed video-service integration. Portability is on the [roadmap](../../ROADMAP.md).

Read the [data flow](privacy.md) before uploading sensitive media. Preserve your original files outside an ephemeral execution workspace.

## See usage

The compact tile above the chat input shows today's recorded token usage and available cost totals. Tap it to open the full statistics view. Costs come from provider reports or configured pricing where available; missing prices are not proof of free usage. Different currencies remain separate.

## Get help

Use the [bug report form](https://github.com/AIM-IT4/slate/issues/new?template=0_bug_report.yml). Include the app version, device, Android version, steps, and a redacted error. Report vulnerabilities through [SECURITY.md](../../SECURITY.md).

## Instabox execution and on-device deliverables

Add the hosted Instabox MCP connection (`https://api.instabox.sh/mcp`) with its API key in the
connection's saved request headers, then enable that server in the chosen Agent's Tools. Merely
saving a server does not bind it to an Agent. When available, Instabox takes precedence in the
execution guidance over the legacy Slate Cloud Execution service. No Render relay or SSH is used
for this file-delivery path. Keep work under `/data/slate`, with finished outputs under
`/data/slate/outputs`, and preserve the machine.

After finishing a render, the Agent computes the final file's byte count and SHA-256 and calls
`slate_save_file_to_phone`. Slate adds this local delivery tool to a verified Instabox catalog; it
is not a tool implemented by the remote server. It uses the saved connection's authentication to
stream the file directly from Instabox's file API, verifies size and SHA-256, and attaches the
managed on-device file to the conversation. Supported formats use the existing inline player or
preview. It does not synchronize every file on the VM or watch a running job while the app is closed.

The file limit is 2 GiB and each transfer has a five-minute timeout. The machine must be available
for the transfer. Cancellation, HTTP errors, incomplete bytes and checksum mismatches do not
publish a completed attachment. The remote original is not deleted, so a failed download can be
retried without rendering again. Files saved successfully remain in Slate's private on-device
file library after the machine stops. Share/Open with exports a copy; uninstalling Slate can
remove its private files. This connection and phone transfer require live device acceptance.
