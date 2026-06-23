# Security Policy

## Reporting a vulnerability

Please report security issues **privately** via GitHub's Security Advisory flow:
[Report a vulnerability](https://github.com/gogetrekt/bjir/security/advisories/new).

Do **not** open a public issue for a security problem.

You'll get a response with next steps. We'll keep you informed of progress toward
a fix and may ask for more detail. Please give us a reasonable window to address
the issue before any public disclosure.

> **Note:** AI-generated, low-effort, or speculative "reports" with no concrete,
> reproducible impact will be closed without review. Include a clear description,
> affected version, and steps to reproduce.

## Threat model

### BJIR runs locally and is not sandboxed

BJIR is an AI coding agent that runs on your machine with access to powerful
tools: shell execution, file read/write, and network access. It does **not**
sandbox the agent.

The permission system (prompts before running commands, editing files, etc.) is a
**UX safety feature** to keep you aware of what the agent is about to do. It is
**not** a security boundary. Do not rely on it to contain untrusted input or
untrusted code.

If you need real isolation, run BJIR inside a container or VM.

### Server mode

`bjir serve` is opt-in. When you enable it, set `OPENCODE_SERVER_PASSWORD` to
require HTTP Basic Auth. Without a password the server runs unauthenticated (with
a warning); securing an exposed server is the operator's responsibility.

### The BJIR Gateway

`bjir gateway` is a local proxy bound to `127.0.0.1` (default port `9090`). It
forwards your requests to the model providers you've configured. Treat it as part
of your local trust boundary, and don't expose the gateway port to untrusted
networks.

### API keys

Provider API keys are stored in your local config (`~/.config/opencode/`) and the
repo-root `.env` for the gateway. Keep these files private. Keys added through the
connect dialog are written to config in plaintext, so protect that file's
permissions accordingly, and never commit `.env` or your config.

## Out of scope

| Category | Rationale |
| --- | --- |
| **Server access when opted in** | If you enable `bjir serve`, API access is expected behavior. |
| **"Sandbox escapes"** | The permission system is not a sandbox (see above). |
| **LLM provider data handling** | Data sent to a provider you configure is governed by that provider's policies. |
| **MCP server behavior** | External MCP servers you configure are outside the trust boundary. |
| **Malicious config files** | You control your own config; editing it is not an attack vector. |
