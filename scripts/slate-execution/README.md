# Slate Execution

An optional Python HTTPS-MCP backend for a dedicated Linux workspace. It exposes command execution, job status, workspace files, and rendering-related helpers. The phone connects as an MCP client; no SSH client is required for this path.

This is a command-capable service. Run it on an isolated host you control, not beside unrelated secrets or sensitive applications. Authentication is required. Put it behind HTTPS before connecting from a phone.

## Build and run locally

From the repository root:

```bash
docker build -t slate-execution -f scripts/slate-execution/Dockerfile .

# Enter a unique access key from your password manager when prompted.
# The service stores its SHA-256, rather than the plaintext access key.
export SLATE_TOKEN_SHA256="$(python3 -c 'import getpass,hashlib; print(hashlib.sha256(getpass.getpass("Access key: ").encode()).hexdigest())')"

docker run --rm   -p 127.0.0.1:10000:10000   --env SLATE_TOKEN_SHA256   --mount type=volume,source=slate-workspace,target=/workspace   slate-execution
```

The local listener is `http://127.0.0.1:10000/mcp`. A phone needs a reachable HTTPS endpoint served by a reverse proxy or hosting platform; the phone's `localhost` is not this machine.

## Settings

| Variable | Purpose |
| --- | --- |
| `SLATE_TOKEN_SHA256` | Required SHA-256 hex digest of your unique access key |
| `SLATE_WORKSPACE` | Workspace directory; the container uses `/workspace` |
| `PORT` | Listener port; defaults to `10000` |
| `RENDER_EXTERNAL_URL` | Public origin used when constructing artifact URLs; set it to your HTTPS origin, including on another hosting platform |

Keep the workspace volume writable by container UID 1000. Choose storage, backups, resource limits, and job lifetimes for your deployment. Do not use artificial keepalive traffic to bypass a hosting provider's free-tier rules.

## Connect Slate

Use **Request headers** authentication with your HTTPS `/mcp` URL and:

```text
Authorization=Bearer YOUR_ACCESS_KEY
```

Enable the discovered tools for your agent, then test a harmless command. The app's video-frame preparation currently has a fixed Slate Execution origin and is a separate integration from a manually added command server.

## Verify the server

```bash
python3 -m unittest discover -s scripts/slate-execution -p 'test_*.py'
```

Review [server.py](server.py) before deploying it. This is a personal-workspace implementation, not a hardened multi-tenant sandbox. A server token grants powerful access; rotate it if exposed.
