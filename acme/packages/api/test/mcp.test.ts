import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type Cart,
  createMemoryStore,
  type Order,
  type Page,
  type Product,
  type Store,
} from '@acme/core'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createApp } from '../src/app.ts'

const ALPHA = 'acme_test_alpha'
const BETA = 'acme_test_beta'

function setup() {
  const stores = new Map<string, Store>()
  const app = createApp({
    storeForKey(key) {
      let store = stores.get(key)
      if (!store) {
        store = createMemoryStore()
        stores.set(key, store)
      }
      return store
    },
    clock: () => new Date('2026-06-01T12:00:00.000Z'),
  })

  async function connect(key: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL('http://acme.test/mcp'), {
      authProvider: { token: async () => key },
      fetch: async (input, init) => app.fetch(new Request(input, init)),
    })
    const client = new Client({ name: 'api-test', version: '0.0.0' })
    await client.connect(transport)
    return client
  }

  async function v1<T>(key: string, method: string, path: string, body?: unknown) {
    const res = await app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: (await res.json()) as T }
  }

  return { app, connect, v1 }
}

async function callTool<T>(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const result = await client.callTool({ name, arguments: args })
  assert.notEqual(result.isError, true)
  return result.structuredContent as T
}

test('/mcp lists the 11 tools', async () => {
  const { connect } = setup()
  const client = await connect(ALPHA)
  try {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map((t) => t.name).sort(), [
      'add_cart_item',
      'cancel_order',
      'checkout',
      'create_cart',
      'get_cart',
      'get_order',
      'get_product',
      'list_orders',
      'remove_cart_item',
      'search_products',
      'update_cart_item',
    ])
  } finally {
    await client.close()
  }
})

test("/mcp calls a tool against the key's data", async () => {
  const { connect } = setup()
  const client = await connect(ALPHA)
  try {
    const page = await callTool<Page<Product>>(client, 'search_products', {
      category: 'audio',
      limit: 2,
    })
    assert.equal(page.data.length, 2)
    assert.equal(page.nextCursor, 'prod_002')
    const failed = await client.callTool({
      name: 'get_product',
      arguments: { productId: 'prod_999' },
    })
    assert.equal(failed.isError, true)
  } finally {
    await client.close()
  }
})

test('/mcp isolates the tenants', async () => {
  const { connect } = setup()
  const alpha = await connect(ALPHA)
  const beta = await connect(BETA)
  try {
    const cart = await callTool<Cart>(alpha, 'create_cart', {})
    assert.equal(cart.id, 'cart_0001')
    await callTool<Cart>(alpha, 'add_cart_item', {
      cartId: cart.id,
      productId: 'prod_003',
      quantity: 1,
    })
    const missing = await beta.callTool({ name: 'get_cart', arguments: { cartId: cart.id } })
    assert.equal(missing.isError, true)
    const own = await callTool<Cart>(beta, 'create_cart', {})
    assert.equal(own.id, 'cart_0001')
    assert.deepEqual(own.items, [])
  } finally {
    await alpha.close()
    await beta.close()
  }
})

test('/v1 and /mcp share the state of one key', async () => {
  const { connect, v1 } = setup()
  const client = await connect(ALPHA)
  try {
    const cart = (await v1<Cart>(ALPHA, 'POST', '/v1/carts')).body
    await v1(ALPHA, 'POST', `/v1/carts/${cart.id}/items`, { productId: 'prod_003', quantity: 2 })
    const viaMcp = await callTool<Cart>(client, 'get_cart', { cartId: cart.id })
    assert.equal(viaMcp.subtotalCents, 11800)
    const order = await callTool<Order>(client, 'checkout', {
      cartId: cart.id,
      paymentToken: 'tok_ok',
    })
    const viaHttp = await v1<Order>(ALPHA, 'GET', `/v1/orders/${order.id}`)
    assert.equal(viaHttp.status, 200)
    assert.equal(viaHttp.body.totalCents, order.totalCents)
  } finally {
    await client.close()
  }
})

test('/mcp without a valid key answers 401 with the envelope and a Bearer challenge', async () => {
  const { app } = setup()
  for (const authorization of [undefined, 'Bearer nope', 'Bearer acme_test_']) {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    assert.equal(res.status, 401, String(authorization))
    assert.equal(res.headers.get('www-authenticate'), 'Bearer')
    const body = (await res.json()) as { error: { code: string } }
    assert.equal(body.error.code, 'unauthorized')
  }
})

test('/mcp answers 413 to a body over 64 KiB', async () => {
  const { app } = setup()
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ALPHA}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { pad: 'x'.repeat(64 * 1024) },
    }),
  })
  assert.equal(res.status, 413)
})

test('a client without a key cannot connect to /mcp', async () => {
  const { app } = setup()
  const transport = new StreamableHTTPClientTransport(new URL('http://acme.test/mcp'), {
    fetch: async (input, init) => app.fetch(new Request(input, init)),
  })
  const client = new Client({ name: 'api-test', version: '0.0.0' })
  await assert.rejects(client.connect(transport), /"code":"unauthorized"/)
  await client.close()
})

interface RpcReply {
  result?: { tools?: { name: string }[]; structuredContent?: Cart; isError?: boolean }
  error?: unknown
}

test('a 2025-06-18 client with no session id can initialize, list and call tools', async () => {
  const { app, v1 } = setup()
  async function rpc(body: unknown): Promise<{ status: number; reply?: RpcReply }> {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${ALPHA}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        'mcp-protocol-version': '2025-06-18',
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (text === '') return { status: res.status }
    const json = res.headers.get('content-type')?.includes('text/event-stream')
      ? (text.split('\n').find((line) => line.startsWith('data:')) ?? '').slice(5)
      : text
    return { status: res.status, reply: JSON.parse(json) as RpcReply }
  }

  const init = await rpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'legacy-agent', version: '1.0.0' },
    },
  })
  assert.equal(init.status, 200)
  assert.equal(init.reply?.error, undefined)

  assert.equal((await rpc({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202)

  const list = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  assert.equal(list.reply?.result?.tools?.length, 11)

  const call = await rpc({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'create_cart', arguments: {} },
  })
  assert.notEqual(call.reply?.result?.isError, true)
  const cartId = call.reply?.result?.structuredContent?.id
  assert.equal((await v1<Cart>(ALPHA, 'GET', `/v1/carts/${cartId}`)).status, 200)
})
