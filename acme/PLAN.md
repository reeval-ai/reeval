# acme: mock e-commerce service

acme is a mock product with four surfaces: an HTTP API, a TypeScript SDK, a CLI and an MCP
server. reeval docs snippets run against it. This plan covers the skeleton only. It does not
cover the docs snippets.

Status key: **Decided** = agreed with Jacob. **Assumed** = my recommendation, not yet confirmed.

## Stages

| Stage | Who runs snippets | Where acme runs | In this plan |
|---|---|---|---|
| 1. Local | Developers and the tests | Node process, in-memory store. Never placed in a sandbox | Yes |
| 2. Private deploy | Maintainers and CI | Cloudflare Worker, Durable Object store. Snippets target it | The code, yes. The deploy itself, no |
| 3. Public deploy | Any docs reader | Public Worker, npm packages, abuse limits | No |

The server's code stays out of the sandbox: an eval reaches the deployed Worker through `egress`
and an `ACME_API_KEY` secret. The CLI and the stdio MCP bin do run in the sandbox.

## Decisions

| # | Topic | Decision | Status |
|---|---|---|---|
| 1 | Location | Top-level `acme/`, developed on a branch. Self-contained, so a later move is `git mv` | Decided |
| 2 | HTTP framework | Hono. One app, a Node entry now, a Worker entry at stage 2 | Decided |
| 3 | Store | A `Store` interface over one `TenantState` document for each key: `read()` and `transact(fn)`. A memory implementation for Node, a Durable Object (one for each key) for the Worker | Decided |
| 4 | Isolation | One seeded dataset for each API key, in every stage | Decided |
| 5 | MCP shapes | Remote Streamable HTTP at `/mcp` on the API, and a local stdio bin | Decided |
| 6 | MCP library | `@modelcontextprotocol/server` v2, exact pin. `createMcpHandler` for HTTP, `serveStdio` for the bin, one `buildServer` factory for both | Decided |
| 7 | Resources | Products, carts, orders, coupons (see [API](#api)) | Decided |
| 8 | Workspace | `acme/` is its own pnpm workspace with its own lockfile. It is not in the root `pnpm-workspace.yaml` | Assumed |
| 9 | API key model | `Authorization: Bearer acme_test_<any string>`. Each distinct key is a tenant. No signup | Assumed |
| 10 | Reset | `POST /v1/reset` restores the seed data of the caller's key | Assumed |
| 11 | Ids and time | Deterministic: a counter for each tenant (`cart_0001`, `order_0001`) and an injected clock | Assumed |
| 12 | Money | Integer cents, USD only | Assumed |
| 13 | Idempotency | `Idempotency-Key` header on checkout | Assumed |
| 14 | stdio MCP backend | The stdio bin calls the API through the SDK (`ACME_API_KEY`, `ACME_BASE_URL`) | Assumed |
| 15 | Tooling | TypeScript, tsdown, zod 4, `node:test`, the repo's Biome config | Assumed |
| 16 | Bundles | The `acme` and `acme-mcp` bins each build to one self-contained `.mjs` file with no runtime install | Assumed |
| 17 | CLI parser | `commander`, inlined into the bundle | Assumed |

Reasons for the assumed rows:

- **8.** The root workspace, lockfile, knip config and CI scope stay untouched. A lockfile change
  in the root runs every Linux CI job.
- **9.** Zero setup for a snippet. The prefix makes a wrong or missing key an explicit `401`.
- **11.** Graders can assert exact ids, totals and timestamps.
- **14.** A local process cannot reach the server's store. The tool definitions stay
  single-sourced, and only the `AcmeServices` implementation differs.
- **16.** A reeval environment places files with `directory()` and `file()`, and the sandbox has
  restricted egress. A single file needs no `npm install` in the sandbox.

## Layout

```
acme/
  package.json            # private workspace root: build, test, lint scripts
  pnpm-workspace.yaml     # packages/*
  tsconfig.base.json
  packages/
    core/                 # @acme/core: the contract and the domain. No I/O
      src/schemas.ts      #   zod schemas and the types inferred from them
      src/errors.ts       #   AcmeError, the error codes and their HTTP statuses
      src/services.ts     #   interface AcmeServices; createServices(store, clock)
      src/store.ts        #   interface Store; createMemoryStore()
      src/seed.ts         #   products, coupons, the seeded orders
    api/                  # @acme/api: Hono app
      src/app.ts          #   createApp({ storeForKey, clock }): routes, auth, errors, /mcp
      src/node.ts         #   bin acme-server (@hono/node-server)
    sdk/                  # @acme/sdk: fetch client, implements AcmeServices
      src/index.ts        #   class Acme { products, carts, orders }
    cli/                  # @acme/cli: bin acme, built on @acme/sdk
    mcp/                  # @acme/mcp
      src/server.ts       #   buildServer(services: AcmeServices): McpServer
      src/bin.ts          #   bin acme-mcp: serveStdio(() => buildServer(new Acme(...)))
  test/                   # end-to-end: one server, driven through all four surfaces
```

Dependency rule: `core` imports nothing of acme's. `api`, `sdk` and `mcp` import `core`. `cli`
imports `sdk`. `api` imports `mcp` (`./server` only) for the `/mcp` route. Nothing imports from
the reeval packages.

`AcmeServices` is the one contract. The API routes, the SDK and the MCP tools all have the same
operations with the same names, inputs and outputs.

## API

Base path `/v1`. JSON only. Auth on every route except `GET /health`. Inputs are strict: an
unknown query or body field is `invalid_request`.

| Method and path | Operation | Notes |
|---|---|---|
| `GET /v1/products` | `products.list` | `q`, `category` (`audio`, `computing`, `home` or `outdoors`), `cursor` (the id of a product in the filtered list), `limit` (default 10, max 50, decimal digits) |
| `GET /v1/products/:id` | `products.get` | |
| `POST /v1/carts` | `carts.create` | |
| `GET /v1/carts/:id` | `carts.get` | Returns items and subtotal |
| `POST /v1/carts/:id/items` | `carts.addItem` | `{ productId, quantity }` |
| `PATCH /v1/carts/:id/items/:productId` | `carts.updateItem` | `{ quantity }` |
| `DELETE /v1/carts/:id/items/:productId` | `carts.removeItem` | |
| `POST /v1/orders` | `orders.create` | `{ cartId, paymentToken, couponCode? }`, `Idempotency-Key` |
| `GET /v1/orders` | `orders.list` | `cursor` (the id of an order of any status), `limit`, `status` |
| `GET /v1/orders/:id` | `orders.get` | |
| `POST /v1/orders/:id/cancel` | `orders.cancel` | |
| `POST /v1/reset` | `reset` | Restores the seed data of this key |
| `ALL /mcp` | | MCP Streamable HTTP, same bearer key |

Error envelope: `{ "error": { "code": "...", "message": "..." } }`.

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | Missing key, or a key without the `acme_test_` prefix |
| `invalid_request` | 400 | The body or query fails its schema, has an unknown field, or names an unknown cursor |
| `invalid_request` | 413 | The body is larger than 64 KiB |
| `not_found` | 404 | Unknown product, cart or order |
| `insufficient_stock` | 409 | Checkout of more than the stock |
| `cart_empty` | 409 | Checkout of an empty cart |
| `payment_declined` | 402 | `paymentToken` is `tok_declined` |
| `coupon_invalid` | 422 | Unknown or expired code, or minimum spend not met |
| `order_not_cancelable` | 409 | The order is `shipped` or `canceled` |
| `internal_error` | 500 | An unexpected server fault |

## Seed data

- 24 products in 4 categories (`audio`, `computing`, `home`, `outdoors`), ids `prod_001` to `prod_024`. Two have stock 0. The list needs
  three pages at the default limit.
- Coupons: `WELCOME10` (10% off), `SAVE5` (500 cents off, minimum spend 5000), `EXPIRED20`
  (expired).
- Payment tokens: `tok_ok` succeeds, `tok_declined` fails.
- Two seeded orders: one `paid` (cancelable) and one `shipped` (not cancelable).
- Order statuses: `paid`, `shipped`, `canceled`.

## SDK

```ts
import { Acme } from '@acme/sdk'

const acme = new Acme({ apiKey: process.env.ACME_API_KEY, baseUrl: process.env.ACME_BASE_URL })
const page = await acme.products.list({ category: 'audio' })
const cart = await acme.carts.create()
await acme.carts.addItem(cart.id, { productId: 'prod_003', quantity: 2 })
const order = await acme.orders.create({ cartId: cart.id, paymentToken: 'tok_ok' })
```

- `fetch` only, no runtime dependencies. It throws `AcmeError` with `code` and `status`.
- Defaults: `apiKey` from `ACME_API_KEY`, `baseUrl` from `ACME_BASE_URL`, then
  `http://localhost:8787`, and `timeoutMs` 30000 (0 disables it).

## CLI

```
acme products list [--q <text>] [--category <name>] [--limit <n>] [--cursor <c>]
acme products get <id>
acme carts create | get <id> | add <id> <productId> [--quantity <n>]
acme carts update <id> <productId> --quantity <n> | remove <id> <productId>
acme orders create --cart <id> --payment-token <t> [--coupon <code>] [--idempotency-key <k>]
acme orders list [--status <s>] | get <id> | cancel <id>
acme reset
```

- `--json` prints the raw response. The default is a short table.
- Exit codes: 0 success, 1 API error (the code and message on stderr), 2 usage error.

## MCP tools

`search_products`, `get_product`, `create_cart`, `get_cart`, `add_cart_item`, `update_cart_item`,
`remove_cart_item`, `checkout`, `get_order`, `list_orders`, `cancel_order`.

- Each tool's input schema is the zod schema of its operation in `@acme/core`.
- A tool handler calls only `AcmeServices`. It does not read the transport's auth.
- `/mcp` on the API: the Hono auth middleware resolves the key, then
  `createMcpHandler(() => buildServer(createServices(storeForKey(key), clock)))`.

## Work batches

Each batch is one agent. The limits at the end apply to every brief.

**Batch 0, serial, reviewed before the fan-out.** Everything else builds on it.

- The workspace scaffold: every `package.json` with all of its dependencies declared, the
  tsconfig files, the tsdown configs, one `pnpm install`.
- All of `@acme/core`: schemas, errors, `AcmeServices`, `Store`, the memory store, the seed data,
  `createServices`.
- Unit tests of the services on the memory store: each operation and each error code.

**Batch 1, four agents in parallel, one package each.**

| Agent | Package | Done when |
|---|---|---|
| A | `api` | Every route and error passes tests through `app.request()`. `acme-server` starts and answers `GET /health`. The `/mcp` mount is left to batch 2 |
| B | `sdk` | Every method passes tests against a stub `fetch`. `Acme` satisfies `AcmeServices` in the type check |
| C | `cli` | Every command passes tests against a stub `AcmeServices`. The exit codes are tested |
| D | `mcp` | `buildServer` lists the 11 tools, and each one passes a test against a stub `AcmeServices`. The stdio bin builds |

**Batch 2, serial.**

- The `/mcp` route in `api`.
- `acme/test/`: start `acme-server` on a free port, then run one flow (search, cart, checkout,
  read back, cancel) through the SDK, the CLI, the stdio MCP bin and the remote MCP endpoint.
- Build every bundle. Run `pnpm format`, `pnpm lint` and `typos` from the repo root.

**Batch 3, serial. No deploy.**

- `api/src/worker.ts`: the Worker entry, and the Durable Object that implements `Store`.
- `api/wrangler.jsonc`. No `nodejs_compat` unless the MCP SDK needs it, and then say why.
- The batch 0 store tests run against the Durable Object store as a conformance suite.
- A test of the Worker in a local workerd: one flow through `/v1` and one tool call on `/mcp`.

Limits for every brief:

- Write only inside the batch's own package directory (batch 0 and 2: inside `acme/`).
- Do not change `@acme/core` after batch 0. Report a contract problem, do not fix it.
- Do not add a dependency. Report the need.
- Out of scope: any deploy (`wrangler deploy`, a Cloudflare login), npm publish, OpenAPI output,
  docs snippets, any file outside `acme/`, the existing `acme` names in `docs/` and `examples/`,
  commits and pushes.

## Open questions

1. `docs/` and `examples/` already use `acme` for other mock products (`acme-sdk` is a weather
   client, `acme-billing`, `acme-math`). Decide later if they move to this product.
2. Running the server beside an attempt, with no deploy, waits on reeval-ai/reeval#1148.

## After the skeleton

- The deploy, with Jacob's Cloudflare account and go-ahead.
- Test `/mcp` against each target agent CLI. Most of them still use the 2025 protocol and take
  the SDK's legacy path.
- Stage 3: storage caps, eviction of idle keys, rate limits, npm publish.
