import assert from 'node:assert/strict'
import { type ChildProcess, spawn } from 'node:child_process'
import { once } from 'node:events'
import { dirname, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { Acme } from '../packages/sdk/src/index.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_BIN = resolve(ROOT, 'packages/api/dist/node.mjs')
const CLI_BIN = resolve(ROOT, 'packages/cli/dist/bin.mjs')
const MCP_BIN = resolve(ROOT, 'packages/mcp/dist/bin.mjs')

const START_TIMEOUT_MS = 20_000
const LISTENING = /acme-server listening on http:\/\/127\.0\.0\.1:(\d+)/

interface Money {
  id: string
  priceCents: number
}

interface OrderView {
  id: string
  status: string
  totalCents: number
  items: { productId: string; quantity: number }[]
}

/** The same flow, as each surface performs it. */
interface Surface {
  searchProducts(q: string): Promise<Money[]>
  createCart(): Promise<{ id: string }>
  addItem(cartId: string, productId: string, quantity: number): Promise<{ subtotalCents: number }>
  checkout(cartId: string): Promise<OrderView>
  getOrder(id: string): Promise<OrderView>
  cancelOrder(id: string): Promise<OrderView>
}

let server: ChildProcess
let baseUrl: string

function startServer(): Promise<{ child: ChildProcess; url: string }> {
  const child = spawn(process.execPath, [SERVER_BIN], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  return new Promise((resolveStart, reject) => {
    const fail = (error: Error) => {
      clearTimeout(timer)
      child.kill('SIGKILL')
      reject(error)
    }
    const timer = setTimeout(() => fail(new Error('acme-server did not start')), START_TIMEOUT_MS)
    let buffered = ''
    child.stdout?.on('data', (chunk: Buffer) => {
      buffered += chunk.toString()
      const match = LISTENING.exec(buffered)
      if (match) {
        clearTimeout(timer)
        resolveStart({ child, url: `http://127.0.0.1:${match[1]}` })
      }
    })
    child.once('error', fail)
    child.once('exit', (code) => fail(new Error(`acme-server exited with ${code}`)))
  })
}

before(async () => {
  const started = await startServer()
  server = started.child
  baseUrl = started.url
})

after(async () => {
  if (server === undefined || server.exitCode !== null) return
  const exited = once(server, 'exit')
  server.kill('SIGTERM')
  await exited
})

async function runFlow(surface: Surface): Promise<void> {
  const [product] = await surface.searchProducts('headphones')
  assert.ok(product)
  assert.equal(product.id, 'prod_001')

  const cart = await surface.createCart()
  assert.equal(cart.id, 'cart_0001')
  const filled = await surface.addItem(cart.id, product.id, 2)
  assert.equal(filled.subtotalCents, product.priceCents * 2)

  const order = await surface.checkout(cart.id)
  assert.equal(order.id, 'order_0003')
  assert.equal(order.status, 'paid')
  assert.equal(order.totalCents, product.priceCents * 2)
  assert.deepEqual(
    order.items.map((i) => [i.productId, i.quantity]),
    [[product.id, 2]],
  )

  const read = await surface.getOrder(order.id)
  assert.deepEqual(read, order)

  const canceled = await surface.cancelOrder(order.id)
  assert.equal(canceled.id, order.id)
  assert.equal(canceled.status, 'canceled')
}

function sdkSurface(apiKey: string): Surface {
  const acme = new Acme({ apiKey, baseUrl })
  return {
    searchProducts: async (q) => (await acme.products.list({ q })).data,
    createCart: () => acme.carts.create(),
    addItem: (cartId, productId, quantity) => acme.carts.addItem(cartId, { productId, quantity }),
    checkout: (cartId) => acme.orders.create({ cartId, paymentToken: 'tok_ok' }),
    getOrder: (id) => acme.orders.get(id),
    cancelOrder: (id) => acme.orders.cancel(id),
  }
}

interface CliResult {
  code: number | null
  stdout: string
  stderr: string
}

function cli(apiKey: string, args: string[]): Promise<CliResult> {
  const child = spawn(process.execPath, [CLI_BIN, ...args], {
    env: { ...process.env, ACME_API_KEY: apiKey, ACME_BASE_URL: baseUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  return new Promise((resolveRun, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolveRun({ code, stdout, stderr }))
  })
}

async function cliJson<T>(apiKey: string, args: string[]): Promise<T> {
  const result = await cli(apiKey, ['--json', ...args])
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stderr, '')
  return JSON.parse(result.stdout) as T
}

function cliSurface(apiKey: string): Surface {
  return {
    searchProducts: async (q) =>
      (await cliJson<{ data: Money[] }>(apiKey, ['products', 'list', '--q', q])).data,
    createCart: () => cliJson(apiKey, ['carts', 'create']),
    addItem: (cartId, productId, quantity) =>
      cliJson(apiKey, ['carts', 'add', cartId, productId, '--quantity', String(quantity)]),
    checkout: (cartId) =>
      cliJson(apiKey, ['orders', 'create', '--cart', cartId, '--payment-token', 'tok_ok']),
    getOrder: (id) => cliJson(apiKey, ['orders', 'get', id]),
    cancelOrder: (id) => cliJson(apiKey, ['orders', 'cancel', id]),
  }
}

function mcpSurface(client: Client): Surface {
  async function call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const result = await client.callTool({ name, arguments: args })
    assert.notEqual(result.isError, true, JSON.stringify(result.content))
    return result.structuredContent as T
  }
  return {
    searchProducts: async (q) => (await call<{ data: Money[] }>('search_products', { q })).data,
    createCart: () => call('create_cart', {}),
    addItem: (cartId, productId, quantity) =>
      call('add_cart_item', { cartId, productId, quantity }),
    checkout: (cartId) => call('checkout', { cartId, paymentToken: 'tok_ok' }),
    getOrder: (orderId) => call('get_order', { orderId }),
    cancelOrder: (orderId) => call('cancel_order', { orderId }),
  }
}

async function withStdioClient<T>(apiKey: string, use: (client: Client) => Promise<T>): Promise<T> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MCP_BIN],
    env: { ACME_API_KEY: apiKey, ACME_BASE_URL: baseUrl },
    stderr: 'inherit',
  })
  const client = new Client({ name: 'e2e', version: '0.0.0' })
  try {
    await client.connect(transport)
    return await use(client)
  } finally {
    await client.close()
  }
}

async function withRemoteClient<T>(
  apiKey: string,
  use: (client: Client) => Promise<T>,
): Promise<T> {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    authProvider: { token: async () => apiKey },
  })
  const client = new Client({ name: 'e2e', version: '0.0.0' })
  try {
    await client.connect(transport)
    return await use(client)
  } finally {
    await client.close()
  }
}

test('the SDK runs the flow', async () => {
  await runFlow(sdkSurface('acme_test_e2e_sdk'))
})

test('the CLI runs the flow in --json mode', async () => {
  await runFlow(cliSurface('acme_test_e2e_cli'))
})

test('the CLI exits 1 with the error code on stderr for an API error', async () => {
  const result = await cli('acme_test_e2e_cli_error', ['--json', 'products', 'get', 'prod_999'])
  assert.equal(result.code, 1)
  assert.equal(result.stdout, '')
  const { error } = JSON.parse(result.stderr) as { error: { code: string; message: string } }
  assert.equal(error.code, 'not_found')
  assert.equal(typeof error.message, 'string')
})

test('the CLI exits 1 on a refused key', async () => {
  const result = await cli('not-an-acme-key', ['--json', 'products', 'list'])
  assert.equal(result.code, 1)
  const { error } = JSON.parse(result.stderr) as { error: { code: string; message: string } }
  assert.equal(error.code, 'unauthorized')
  assert.equal(
    error.message,
    'Missing or invalid API key: it must start with acme_test_ (for example acme_test_demo), sent as "Authorization: Bearer <key>" (the CLI and the SDK send ACME_API_KEY this way)',
  )
})

const CATEGORY_ERROR =
  'category: Invalid option: expected one of "audio"|"computing"|"home"|"outdoors"'
const CURSOR_ERROR =
  'cursor: "prod_999" is not the id of a product in this list. Pass the nextCursor of the previous page, or no cursor for the first page'

test('the API refuses an unknown field, a wrong category and an unknown cursor with 400', async () => {
  const get = async (query: string) => {
    const response = await fetch(`${baseUrl}/v1/products?${query}`, {
      headers: { authorization: 'Bearer acme_test_e2e_refusals' },
    })
    return { status: response.status, body: await response.json() }
  }
  for (const [query, message] of [
    ['query=lamp', 'Unrecognized key: "query"'],
    ['category=toys', CATEGORY_ERROR],
    ['cursor=prod_999', CURSOR_ERROR],
  ] as const) {
    assert.deepEqual(
      await get(query),
      { status: 400, body: { error: { code: 'invalid_request', message } } },
      query,
    )
  }
})

test('the SDK and the CLI report the same refusals', async () => {
  const acme = new Acme({ apiKey: 'acme_test_e2e_refusals_sdk', baseUrl })
  const unknown = { q: 'lamp', query: 'lamp' }
  await assert.rejects(acme.products.list(unknown), {
    code: 'invalid_request',
    message: 'Unrecognized key: "query"',
  })
  const result = await cli('acme_test_e2e_refusals_cli', [
    'products',
    'list',
    '--cursor',
    'prod_999',
  ])
  assert.deepEqual(result, {
    code: 1,
    stdout: '',
    stderr: `error: invalid_request: ${CURSOR_ERROR}\n`,
  })
})

test('the CLI exits 2 on a usage error', async () => {
  const result = await cli('acme_test_e2e_cli_usage', ['orders', 'create'])
  assert.equal(result.code, 2)
})

test('the stdio MCP bin runs the flow', async () => {
  await withStdioClient('acme_test_e2e_stdio', (client) => runFlow(mcpSurface(client)))
})

test('the remote MCP endpoint runs the flow', async () => {
  await withRemoteClient('acme_test_e2e_remote', (client) => runFlow(mcpSurface(client)))
})

test('an order created through the CLI is visible through the SDK, stdio MCP and remote MCP', async () => {
  const key = 'acme_test_e2e_cross'
  const cliApi = cliSurface(key)
  const cart = await cliApi.createCart()
  await cliApi.addItem(cart.id, 'prod_003', 1)
  const order = await cliApi.checkout(cart.id)

  assert.deepEqual(await sdkSurface(key).getOrder(order.id), order)
  assert.deepEqual(
    await withStdioClient(key, (client) => mcpSurface(client).getOrder(order.id)),
    order,
  )
  assert.deepEqual(
    await withRemoteClient(key, (client) => mcpSurface(client).getOrder(order.id)),
    order,
  )

  const other = await sdkSurface('acme_test_e2e_cross_other')
    .getOrder(order.id)
    .then(
      () => 'found',
      (error: { code?: string }) => error.code,
    )
  assert.equal(other, 'not_found')
})

const MCP_SHAPES = [
  ['stdio MCP bin', withStdioClient],
  ['remote MCP endpoint', withRemoteClient],
] as const

for (const [shape, withClient] of MCP_SHAPES) {
  test(`the ${shape} reports a declined checkout as an error result and keeps the cart`, async () => {
    await withClient(`acme_test_e2e_error_${shape.split(' ')[0]}`, async (client) => {
      const mcp = mcpSurface(client)
      const cart = await mcp.createCart()
      const filled = await mcp.addItem(cart.id, 'prod_003', 1)
      const result = await client.callTool({
        name: 'checkout',
        arguments: { cartId: cart.id, paymentToken: 'tok_declined' },
      })
      assert.equal(result.isError, true)
      assert.deepEqual(result.content, [
        { type: 'text', text: 'payment_declined: The payment was declined' },
      ])
      const after = await client.callTool({ name: 'get_cart', arguments: { cartId: cart.id } })
      assert.deepEqual(after.structuredContent, filled)
    })
  })

  test(`the ${shape} refuses an unknown field, a wrong category and an unknown cursor`, async () => {
    await withClient(`acme_test_e2e_refusals_${shape.split(' ')[0]}`, async (client) => {
      const refusal = 'Input validation error: Invalid arguments for tool search_products: '
      for (const [args, text] of [
        [{ query: 'lamp' }, `${refusal}Unrecognized key: "query"`],
        [{ category: 'toys' }, `${refusal}${CATEGORY_ERROR}`],
        [{ cursor: 'prod_999' }, `invalid_request: ${CURSOR_ERROR}`],
      ] as const) {
        const result = await client.callTool({ name: 'search_products', arguments: args })
        assert.equal(result.isError, true, text)
        assert.deepEqual(result.content, [{ type: 'text', text }])
      }
    })
  })

  test(`the ${shape} pages through the catalog with nextCursor`, async () => {
    await withClient(`acme_test_e2e_pages_${shape.split(' ')[0]}`, async (client) => {
      const pages: string[][] = []
      let cursor: string | null = null
      do {
        const result = await client.callTool({
          name: 'search_products',
          arguments: cursor === null ? {} : { cursor },
        })
        const page = result.structuredContent as { data: Money[]; nextCursor: string | null }
        pages.push(page.data.map((product) => product.id))
        cursor = page.nextCursor
      } while (cursor !== null)
      assert.deepEqual(
        pages.map((page) => page.length),
        [10, 10, 4],
      )
      assert.equal(pages.flat().join(), productIds(1, 24).join())
    })
  })
}

function productIds(from: number, to: number): string[] {
  return Array.from(
    { length: to - from + 1 },
    (_, i) => `prod_${String(from + i).padStart(3, '0')}`,
  )
}

const LEGACY_EXCHANGE = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'legacy-agent', version: '1.0.0' },
    },
  },
  { jsonrpc: '2.0', method: 'notifications/initialized' },
  { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'get_product', arguments: { productId: 'prod_003' } },
  },
]

interface LegacyReply {
  id: number
  result: {
    protocolVersion?: string
    tools?: { name: string }[]
    structuredContent?: Money
    isError?: boolean
  }
}

function assertLegacyReplies(replies: LegacyReply[]): void {
  assert.deepEqual(
    replies.map((reply) => reply.id),
    [1, 2, 3],
  )
  const [init, list, call] = replies
  assert.equal(init?.result.protocolVersion, '2025-06-18')
  assert.equal(list?.result.tools?.length, 11)
  assert.notEqual(call?.result.isError, true)
  assert.equal(call?.result.structuredContent?.id, 'prod_003')
}

test('the remote MCP endpoint serves a 2025-06-18 client over plain HTTP', async () => {
  const replies: LegacyReply[] = []
  for (const message of LEGACY_EXCHANGE) {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer acme_test_e2e_legacy_http',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify(message),
    })
    const text = await response.text()
    if (!('id' in message)) {
      assert.equal(response.status, 202, text)
      continue
    }
    assert.equal(response.status, 200, text)
    const json = response.headers.get('content-type')?.includes('text/event-stream')
      ? (text.split('\n').find((line) => line.startsWith('data:')) ?? '').slice(5)
      : text
    replies.push(JSON.parse(json) as LegacyReply)
  }
  assertLegacyReplies(replies)
})

test('the stdio MCP bin serves a 2025-06-18 client and exits when stdin closes', async () => {
  const child = spawn(process.execPath, [MCP_BIN], {
    env: { ...process.env, ACME_API_KEY: 'acme_test_e2e_legacy_stdio', ACME_BASE_URL: baseUrl },
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const exited = once(child, 'exit')
  try {
    const lines = createInterface({ input: child.stdout })
    for (const message of LEGACY_EXCHANGE) child.stdin.write(`${JSON.stringify(message)}\n`)
    const replies: LegacyReply[] = []
    for await (const line of lines) {
      replies.push(JSON.parse(line) as LegacyReply)
      if (replies.length === 3) break
    }
    assertLegacyReplies(replies)
    child.stdin.end()
    assert.deepEqual(await exited, [0, null])
  } finally {
    child.kill('SIGKILL')
  }
})

test('the stdio MCP bin exits 1 with a hint on stderr and nothing on stdout without a key', async () => {
  const env = { ...process.env }
  delete env.ACME_API_KEY
  const child = spawn(process.execPath, [MCP_BIN], { env, stdio: ['pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString()
  })
  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
  })
  const [code] = await once(child, 'close')
  assert.equal(code, 1)
  assert.equal(stdout, '')
  assert.match(stderr, /^acme-mcp: .*\nSet ACME_API_KEY/)
})
