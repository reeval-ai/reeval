import type { Cart } from '@acme/core'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { expect, test } from 'vitest'
import { freshKey, v1, workerFetch } from './helpers.ts'

async function connect(key: string): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL('http://acme.test/mcp'), {
    authProvider: { token: async () => key },
    fetch: (input, init) => workerFetch(input, init),
  })
  const client = new Client({ name: 'worker-test', version: '0.0.0' })
  await client.connect(transport)
  return client
}

test('/mcp lists the tools and shares state with /v1 for the same key', async () => {
  const key = freshKey('mcp')
  const client = await connect(key)
  try {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name)).toContain('create_cart')
    expect(tools).toHaveLength(11)

    const result = await client.callTool({ name: 'create_cart', arguments: {} })
    expect(result.isError).not.toBe(true)
    const cart = result.structuredContent as Cart
    const viaV1 = await v1<Cart>(key, 'GET', `/v1/carts/${cart.id}`)
    expect(viaV1.status).toBe(200)
    expect(viaV1.body.id).toBe(cart.id)
  } finally {
    await client.close()
  }
})

interface RpcReply {
  result?: { tools?: { name: string }[]; structuredContent?: Cart; isError?: boolean }
  error?: unknown
}

async function rpc(key: string, body: unknown): Promise<{ status: number; reply?: RpcReply }> {
  const res = await workerFetch('http://acme.test/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${key}`,
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

test('a 2025-06-18 client with no session id can initialize, list and call tools', async () => {
  const key = freshKey('legacy')
  const init = await rpc(key, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'legacy-agent', version: '1.0.0' },
    },
  })
  expect(init.status).toBe(200)
  expect(init.reply?.error).toBeUndefined()

  const initialized = await rpc(key, { jsonrpc: '2.0', method: 'notifications/initialized' })
  expect(initialized.status).toBe(202)

  const list = await rpc(key, { jsonrpc: '2.0', id: 2, method: 'tools/list' })
  expect(list.reply?.result?.tools).toHaveLength(11)

  const call = await rpc(key, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: { name: 'create_cart', arguments: {} },
  })
  expect(call.reply?.result?.isError).not.toBe(true)
  const cartId = call.reply?.result?.structuredContent?.id
  expect((await v1(key, 'GET', `/v1/carts/${cartId}`)).status).toBe(200)
})
