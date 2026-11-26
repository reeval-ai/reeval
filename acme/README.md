# acme

A mock e-commerce service with four surfaces: an HTTP API, a TypeScript SDK, a CLI and an MCP
server. See [PLAN.md](./PLAN.md) for the design.

`acme/` is its own pnpm workspace with its own lockfile. Run pnpm from this directory.

| Package | What it is |
|---|---|
| `@acme/core` | Schemas, errors, `AcmeServices`, the `Store` and the seed data. No I/O |
| `@acme/api` | Hono app, bin `acme-server`, and the Cloudflare Worker with one Durable Object for each API key |
| `@acme/sdk` | `fetch` client |
| `@acme/cli` | Bin `acme` |
| `@acme/mcp` | MCP server, bin `acme-mcp` |

Packages export their TypeScript source, so they import each other with no build step. Tests run
on Node's type stripping: relative imports end in `.ts`, and no enums, namespaces or parameter
properties.

```bash
pnpm install
pnpm typecheck   # tsc --noEmit in every package and in test/
pnpm test        # build, then node:test in every package, the Worker tests in a local workerd, and test:e2e
pnpm build       # tsdown: one self-contained dist/*.mjs for each bin
pnpm test:e2e    # test/: the built bins on a free port, through the SDK, CLI, stdio MCP and /mcp. Build first
```

Run the bins after `pnpm build`. Any key that starts with `acme_test_` is a tenant with its own
seed data.

```bash
PORT=8787 node packages/api/dist/node.mjs                 # acme-server, on 127.0.0.1 unless HOST is set
ACME_API_KEY=acme_test_me node packages/cli/dist/bin.mjs products list
ACME_API_KEY=acme_test_me node packages/mcp/dist/bin.mjs  # acme-mcp on stdio
```

`acme` and `acme-mcp` call `ACME_BASE_URL`, `http://localhost:8787` by default.

## Cloudflare Worker

The Worker sends each `/v1` and `/mcp` request to the Durable Object of its API key. The object
holds that key's state in its SQLite storage and runs the same app as the Node server. Nothing is
deployed, and nothing here needs a Cloudflare login.

```bash
cd packages/api
pnpm dev:worker    # wrangler dev, local mode, on http://localhost:8787 (state in .wrangler/)
pnpm test:worker   # vitest in a local workerd (@cloudflare/vitest-plugin)
pnpm typecheck     # wrangler types writes worker-configuration.d.ts (ignored by git), then tsc
```
