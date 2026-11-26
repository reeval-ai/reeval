# acme

acme is a mock e-commerce service: a product catalog, carts and orders. It has four surfaces, an
HTTP API, a TypeScript SDK, a CLI and an MCP server, all over the same operations. Documentation
snippets of an eval tool run coding agents against these surfaces, and graders check the results.
It is not deployed.

`acme/` is its own pnpm workspace with its own lockfile. Run pnpm from this directory.

## Packages

| Package | What it is |
|---|---|
| `@acme/core` | Zod schemas, errors, the `AcmeServices` contract and `createServices(store, clock)`, the `Store` and the seed data. No I/O. `@acme/core/testing` has the store conformance cases and a recording stub of `AcmeServices` |
| `@acme/sdk` | The `Acme` client, over `fetch` |
| `@acme/cli` | The bin `acme`, on the SDK |
| `@acme/mcp` | `buildServer(services)` with 11 tools, and the stdio bin `acme-mcp`, on the SDK |
| `@acme/api` | The Hono app (`/v1` and `/mcp`), the Node bin `acme-server`, and the Cloudflare Worker with one Durable Object for each API key |

`core` imports nothing of acme's. `sdk` imports `core`. `cli` and `mcp` import `core` and `sdk`.
`api` imports `core` and `@acme/mcp/server`. Packages export their TypeScript source, so they
import each other with no build step.

## Build, test and run

```bash
pnpm install
pnpm typecheck   # tsc --noEmit in every package and in test/
pnpm build       # tsdown: one self-contained dist/*.mjs for each bin
pnpm test        # build, then every package's tests, the Worker tests in a local workerd, and test:e2e
pnpm test:e2e    # test/: the built bins, through the SDK, the CLI, stdio MCP and /mcp. Build first
pnpm --filter @acme/core test   # one package; @acme/api's tests also need pnpm build first
```

Tests run on Node's type stripping: relative imports end in `.ts`, and there are no enums,
namespaces or parameter properties.

```bash
PORT=8787 node packages/api/dist/node.mjs                 # acme-server, on 127.0.0.1 unless HOST is set
ACME_API_KEY=acme_test_me node packages/cli/dist/bin.mjs products list
ACME_API_KEY=acme_test_me node packages/mcp/dist/bin.mjs  # acme-mcp on stdio
```

`acme`, `acme-mcp` and the SDK call `ACME_BASE_URL`, `http://localhost:8787` by default. The Node
server keeps each key's state in memory until it stops.

The Worker sends each `/v1` and `/mcp` request to the Durable Object of its API key, which holds
that key's state and runs the same app. Nothing here needs a Cloudflare login.

```bash
cd packages/api
pnpm dev:worker    # wrangler dev, local mode, on http://localhost:8787 (state in .wrangler/)
pnpm test:worker   # vitest in a local workerd
```

## API key

Send `Authorization: Bearer <key>`. A key is `acme_test_`, then one or more letters, digits or
`. _ ~ + / -` characters, optionally ending in `=` padding, at most 256 characters in all, such as
`acme_test_demo`. Any other value is `401 unauthorized`. Each distinct key is a tenant with its
own copy of the seed data, and no signup.

## API

Base path `/v1`, JSON only. Every route needs the key but `GET /health`. Inputs are strict: an
unknown query or body field is `invalid_request`. Lists take `limit` (default 10, at most 50) and
`cursor` (the `nextCursor` of the previous page, which is null on the last page).

| Route | Body or query |
|---|---|
| `GET /v1/products` | `q`, `category`, `cursor`, `limit` |
| `GET /v1/products/:id` | |
| `POST /v1/carts` | |
| `GET /v1/carts/:id` | |
| `POST /v1/carts/:id/items` | `{ productId, quantity }`, 1 to 99. It adds to a product already in the cart |
| `PATCH /v1/carts/:id/items/:productId` | `{ quantity }`, 1 to 99 |
| `DELETE /v1/carts/:id/items/:productId` | |
| `POST /v1/orders` | `{ cartId, paymentToken, couponCode? }`, and an optional `Idempotency-Key` header |
| `GET /v1/orders` | `status`, `cursor`, `limit` |
| `GET /v1/orders/:id` | |
| `POST /v1/orders/:id/cancel` | |
| `POST /v1/reset` | Restores the seed data of the key |
| `ALL /mcp` | MCP Streamable HTTP, with the same key |

Money is integer cents in USD. An error is `{ "error": { "code": "...", "message": "..." } }`:

| Code | Status | When |
|---|---|---|
| `unauthorized` | 401 | A missing or invalid key |
| `invalid_request` | 400 | The input fails its schema, has an unknown field, or names an unknown cursor |
| `invalid_request` | 413 | The body is larger than 64 KiB |
| `not_found` | 404 | An unknown product, cart, order, cart line or route |
| `insufficient_stock` | 409 | Checkout of more than the stock |
| `cart_empty` | 409 | Checkout of an empty cart |
| `payment_declined` | 402 | The payment token is `tok_declined` |
| `coupon_invalid` | 422 | An unknown or expired coupon, or a subtotal below its minimum |
| `order_not_cancelable` | 409 | Canceling a `shipped` or `canceled` order |
| `internal_error` | 500 | An unexpected server fault |

## Surfaces

| HTTP | SDK | CLI | MCP tool |
|---|---|---|---|
| `GET /v1/products` | `acme.products.list` | `acme products list` | `search_products` |
| `GET /v1/products/:id` | `acme.products.get` | `acme products get` | `get_product` |
| `POST /v1/carts` | `acme.carts.create` | `acme carts create` | `create_cart` |
| `GET /v1/carts/:id` | `acme.carts.get` | `acme carts get` | `get_cart` |
| `POST /v1/carts/:id/items` | `acme.carts.addItem` | `acme carts add` | `add_cart_item` |
| `PATCH /v1/carts/:id/items/:productId` | `acme.carts.updateItem` | `acme carts update` | `update_cart_item` |
| `DELETE /v1/carts/:id/items/:productId` | `acme.carts.removeItem` | `acme carts remove` | `remove_cart_item` |
| `POST /v1/orders` | `acme.orders.create` | `acme orders create` | `checkout` |
| `GET /v1/orders` | `acme.orders.list` | `acme orders list` | `list_orders` |
| `GET /v1/orders/:id` | `acme.orders.get` | `acme orders get` | `get_order` |
| `POST /v1/orders/:id/cancel` | `acme.orders.cancel` | `acme orders cancel` | `cancel_order` |
| `POST /v1/reset` | `acme.reset` | `acme reset` | none |

- **SDK.** `new Acme({ apiKey, baseUrl, fetch, timeoutMs })`. `apiKey` defaults to `ACME_API_KEY`
  and `timeoutMs` to 30000 (0 disables it). A server error throws `AcmeError` with `code` and
  `status`. No usable response throws `AcmeConnectionError`.
- **CLI.** `--json` prints the raw result on stdout, and an error envelope on stderr. The default
  is a short table. Exit codes: 0 success, 1 an API or connection error, 2 a usage error.
- **MCP.** An error is a tool result with `isError: true` and one text block. An invalid argument
  shows in two forms: `Input validation error: ...` from the MCP SDK when the tool's input schema
  refuses it, and `invalid_request: ...` for a rule the service checks, such as an unknown cursor
  or a cart line past 99. Other errors read `<code>: <message>`.

## Seed data

Every key starts with this data, and `reset` restores it.

- **Products.** 24, `prod_001` to `prod_024`, six in each category: `audio`, `computing`, `home`
  and `outdoors`, in that order. `prod_005` (Vinyl Turntable) and `prod_017` (Smart Plug) have
  stock 0. The catalog is three pages at the default limit.
- **Coupons.** `WELCOME10` takes 10% off, rounded down. `SAVE5` takes 500 cents off a subtotal of
  at least 5000. `EXPIRED20` is expired. Codes are case-sensitive.
- **Payment tokens.** `tok_declined` is declined. Any other token, such as `tok_ok`, succeeds.
- **Orders.** `order_0001` is `paid`: 1 x `prod_001` and 2 x `prod_008`, 22700 cents. It holds its
  stock, so `prod_001` starts at 24 and `prod_008` at 48, and canceling it returns them to 25 and
  50. `order_0002` is `shipped`: 1 x `prod_013`, 3500 cents, and it cannot be canceled. Both are
  dated `2026-01-01T00:00:00.000Z`, and their `cartId` values name carts that do not exist.

## What is deterministic

Ids and totals are exact for a fresh key: each key counts its own ids, so its first cart is
`cart_0001` and its first new order is `order_0003`. Timestamps of new carts and orders come from
the real clock, so a grader should not compare them to fixed values.
