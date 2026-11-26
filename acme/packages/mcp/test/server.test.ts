import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  AcmeConnectionError,
  AcmeError,
  type AcmeServices,
  CATEGORIES,
  type Cart,
  COUPONS,
  createMemoryStore,
  createServices,
  type Order,
  PAYMENT_TOKEN_DECLINED,
  PRODUCTS,
  type Product,
} from '@acme/core'
import {
  cart,
  order,
  orderPage,
  product,
  productPage,
  recordingServices,
  type ServiceCall,
} from '@acme/core/testing'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { buildServer } from '../src/server.ts'

async function connect(services: AcmeServices): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await buildServer(services).connect(serverTransport)
  const client = new Client({ name: 'test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

function textOf(result: { content?: unknown }): string {
  const [block] = result.content as { type: string; text: string }[]
  assert.ok(block)
  assert.equal(block.type, 'text')
  return block.text
}

test('listTools returns the 11 tools with object input schemas', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((tool) => tool.name).sort(), Object.keys(ANNOTATIONS).sort())
  assert.equal(tools.length, 11)
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object', tool.name)
    assert.ok(tool.description && tool.description.length > 40, tool.name)
    assert.ok(tool.outputSchema, tool.name)
  }
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  assert.deepEqual(Object.keys(byName.checkout?.inputSchema.properties ?? {}).sort(), [
    'cartId',
    'couponCode',
    'idempotencyKey',
    'paymentToken',
  ])
  assert.equal(byName.cancel_order?.annotations?.destructiveHint, true)
  assert.equal(byName.get_order?.annotations?.readOnlyHint, true)
  await client.close()
})

type Call = [method: string, ...args: unknown[]]

const cases: { tool: string; args: Record<string, unknown>; expected: Call; value: unknown }[] = [
  {
    tool: 'search_products',
    args: { q: 'head', category: 'audio', limit: 5 },
    expected: ['products.list', { q: 'head', category: 'audio', limit: 5 }],
    value: productPage,
  },
  {
    tool: 'get_product',
    args: { productId: 'prod_003' },
    expected: ['products.get', 'prod_003'],
    value: product,
  },
  { tool: 'create_cart', args: {}, expected: ['carts.create'], value: cart },
  {
    tool: 'get_cart',
    args: { cartId: 'cart_0001' },
    expected: ['carts.get', 'cart_0001'],
    value: cart,
  },
  {
    tool: 'add_cart_item',
    args: { cartId: 'cart_0001', productId: 'prod_003', quantity: 2 },
    expected: ['carts.addItem', 'cart_0001', { productId: 'prod_003', quantity: 2 }],
    value: cart,
  },
  {
    tool: 'update_cart_item',
    args: { cartId: 'cart_0001', productId: 'prod_003', quantity: 4 },
    expected: ['carts.updateItem', 'cart_0001', 'prod_003', { quantity: 4 }],
    value: cart,
  },
  {
    tool: 'remove_cart_item',
    args: { cartId: 'cart_0001', productId: 'prod_003' },
    expected: ['carts.removeItem', 'cart_0001', 'prod_003'],
    value: cart,
  },
  {
    tool: 'checkout',
    args: {
      cartId: 'cart_0001',
      paymentToken: 'tok_ok',
      couponCode: 'SAVE5',
      idempotencyKey: 'k1',
    },
    expected: [
      'orders.create',
      { cartId: 'cart_0001', paymentToken: 'tok_ok', couponCode: 'SAVE5', idempotencyKey: 'k1' },
    ],
    value: order,
  },
  {
    tool: 'get_order',
    args: { orderId: 'order_0001' },
    expected: ['orders.get', 'order_0001'],
    value: order,
  },
  {
    tool: 'list_orders',
    args: { status: 'paid', limit: 3 },
    expected: ['orders.list', { status: 'paid', limit: 3 }],
    value: orderPage,
  },
  {
    tool: 'cancel_order',
    args: { orderId: 'order_0001' },
    expected: ['orders.cancel', 'order_0001'],
    value: { ...order, status: 'canceled' },
  },
]

for (const { tool, args, expected, value } of cases) {
  test(`${tool} calls ${expected[0]} and returns its value`, async () => {
    const { services, calls } = recordingServices()
    const client = await connect(services)
    const result = await client.callTool({ name: tool, arguments: args })
    assert.notEqual(result.isError, true)
    const [method, ...rest] = expected
    assert.deepEqual(calls, [{ method, args: rest } satisfies ServiceCall])
    assert.deepEqual(JSON.parse(textOf(result)), value)
    assert.deepEqual(result.structuredContent, value)
    await client.close()
  })
}

test('an AcmeError becomes an error result with its code', async () => {
  const services = recordingServices().services
  services.orders.create = async () => {
    throw new AcmeError('payment_declined', 'The payment was declined')
  }
  const client = await connect(services)
  const result = await client.callTool({
    name: 'checkout',
    arguments: { cartId: 'cart_0001', paymentToken: 'tok_declined' },
  })
  assert.equal(result.isError, true)
  assert.equal(textOf(result), 'payment_declined: The payment was declined')
  await client.close()
})

test('an invalid or unknown argument is refused before the service is called', async () => {
  const { services, calls } = recordingServices()
  const client = await connect(services)
  const invalid = [
    {
      name: 'add_cart_item',
      arguments: { cartId: 'cart_0001', productId: 'prod_003', quantity: 0 },
    },
    { name: 'add_cart_item', arguments: { productId: 'prod_003', quantity: 1 } },
    { name: 'search_products', arguments: { limit: 500 } },
    { name: 'search_products', arguments: { query: 'headphones' } },
    { name: 'get_order', arguments: { orderId: 'order_0001', id: 'order_0001' } },
    { name: 'list_orders', arguments: { sort: 'desc' } },
    { name: 'checkout', arguments: { cartId: 'cart_0001', paymentToken: 'tok_ok', coupon: 'x' } },
    { name: 'search_products', arguments: { category: 'toys' } },
  ]
  for (const request of invalid) {
    const result = await client.callTool(request)
    assert.equal(result.isError, true, JSON.stringify(request))
    assert.match(textOf(result), new RegExp(`^Input validation error: .*${request.name}`))
  }
  assert.deepEqual(calls, [])
  await client.close()
})

test('an unexpected error becomes internal_error without its message', async (t) => {
  const logged = t.mock.method(console, 'error', () => {})
  const services = recordingServices().services
  const secret = new Error('storage at 10.0.0.7 refused the write')
  services.carts.create = async () => {
    throw secret
  }
  const client = await connect(services)
  const result = await client.callTool({ name: 'create_cart', arguments: {} })
  assert.equal(result.isError, true)
  assert.equal(textOf(result), 'internal_error: Internal server error')
  assert.deepEqual(
    logged.mock.calls.map((call) => call.arguments),
    [[secret]],
  )
  await client.close()
})

test('an unreachable server reaches the agent with its URL', async () => {
  const services = recordingServices().services
  services.products.get = async () => {
    throw new AcmeConnectionError(
      'GET http://localhost:8787/v1/products/prod_003 failed: fetch failed',
    )
  }
  const client = await connect(services)
  const result = await client.callTool({
    name: 'get_product',
    arguments: { productId: 'prod_003' },
  })
  assert.equal(result.isError, true)
  assert.equal(
    textOf(result),
    'GET http://localhost:8787/v1/products/prod_003 failed: fetch failed',
  )
  await client.close()
})

const ANNOTATIONS: Record<string, [readOnly: boolean, destructive: boolean, idempotent: boolean]> =
  {
    search_products: [true, false, true],
    get_product: [true, false, true],
    create_cart: [false, false, false],
    get_cart: [true, false, true],
    add_cart_item: [false, false, false],
    update_cart_item: [false, false, true],
    remove_cart_item: [false, true, true],
    checkout: [false, false, false],
    get_order: [true, false, true],
    list_orders: [true, false, true],
    cancel_order: [false, true, true],
  }

test('each tool has the annotations of its behavior', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  for (const tool of tools) {
    const { readOnlyHint, destructiveHint, idempotentHint, openWorldHint } = tool.annotations ?? {}
    assert.deepEqual(
      [readOnlyHint, destructiveHint, idempotentHint],
      ANNOTATIONS[tool.name],
      tool.name,
    )
    assert.equal(openWorldHint, false, tool.name)
  }
  await client.close()
})

function walk(schema: unknown, visit: (node: Record<string, unknown>) => void): void {
  if (Array.isArray(schema)) {
    for (const item of schema) walk(item, visit)
  } else if (typeof schema === 'object' && schema !== null) {
    visit(schema as Record<string, unknown>)
    for (const value of Object.values(schema)) walk(value, visit)
  }
}

test('the schemas a client receives are plain: closed objects, every input described', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  for (const tool of tools) {
    for (const schema of [tool.inputSchema, tool.outputSchema]) {
      assert.equal(schema?.type, 'object', tool.name)
      walk(schema, (node) => {
        for (const key of ['$ref', '$defs', 'anyOf', 'oneOf', 'allOf']) {
          assert.ok(!(key in node), `${tool.name} has ${key}`)
        }
      })
    }
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name)
    for (const [name, property] of Object.entries(tool.inputSchema.properties ?? {})) {
      const { description } = property as { description?: string }
      assert.ok(description && description.length > 10, `${tool.name}.${name}`)
    }
  }
  await client.close()
})

test('the seed facts the tools quote are the seed data', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  const checkout = JSON.stringify(byName.checkout)
  for (const code of COUPONS.map((coupon) => coupon.code)) assert.ok(checkout.includes(code), code)
  assert.ok(checkout.includes(PAYMENT_TOKEN_DECLINED))
  const { category } = byName.search_products?.inputSchema.properties ?? {}
  const categories = (category as { description: string }).description
  for (const name of new Set(PRODUCTS.map((product) => product.category))) {
    assert.ok(categories.includes(`"${name}"`), name)
  }
  await client.close()
})

async function call(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args })
  return result.isError === true
    ? { error: textOf(result).split(':')[0] }
    : (result.structuredContent as Record<string, unknown>)
}

test('the behavior the descriptions promise holds on the real services', async () => {
  const client = await connect(createServices(createMemoryStore(), () => new Date()))

  const audio = (await call(client, 'search_products', { category: 'audio', limit: 50 })) as {
    data: Product[]
  }
  assert.equal(audio.data.length, 6)

  const pages: string[][] = []
  let cursor: string | undefined
  do {
    const page = (await call(client, 'search_products', cursor ? { cursor } : {})) as {
      data: Product[]
      nextCursor: string | null
    }
    pages.push(page.data.map((product) => product.id))
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  assert.deepEqual(
    pages.map((page) => page.length),
    [10, 10, 4],
  )
  assert.deepEqual(
    pages.flat(),
    PRODUCTS.map((product) => product.id),
  )

  const { id: cartId } = (await call(client, 'create_cart', {})) as { id: string }
  await call(client, 'add_cart_item', { cartId, productId: 'prod_003', quantity: 1 })
  await call(client, 'add_cart_item', { cartId, productId: 'prod_003', quantity: 2 })
  const before = await call(client, 'get_cart', { cartId })
  assert.deepEqual(
    (before as Cart).items.map((item) => item.quantity),
    [3],
  )

  for (const [args, code] of [
    [{ paymentToken: PAYMENT_TOKEN_DECLINED }, 'payment_declined'],
    [{ paymentToken: 'tok_ok', couponCode: 'welcome10' }, 'coupon_invalid'],
    [{ paymentToken: 'tok_ok', couponCode: 'EXPIRED20' }, 'coupon_invalid'],
  ] as const) {
    assert.deepEqual(await call(client, 'checkout', { cartId, ...args }), { error: code })
  }
  assert.deepEqual(await call(client, 'get_cart', { cartId }), before)

  const order = (await call(client, 'checkout', {
    cartId,
    paymentToken: 'tok_ok',
    couponCode: 'WELCOME10',
    idempotencyKey: 'once',
  })) as Order
  assert.equal(order.discountCents, Math.floor(order.subtotalCents / 10))
  assert.deepEqual(
    await call(client, 'checkout', {
      cartId,
      paymentToken: 'tok_ok',
      idempotencyKey: 'once',
    }),
    order,
  )
  assert.deepEqual(((await call(client, 'get_cart', { cartId })) as Cart).items, [])
  assert.deepEqual(await call(client, 'checkout', { cartId, paymentToken: 'tok_ok' }), {
    error: 'cart_empty',
  })

  const canceled = await call(client, 'cancel_order', { orderId: order.id })
  assert.equal((canceled as Order).status, 'canceled')
  assert.deepEqual(await call(client, 'cancel_order', { orderId: order.id }), {
    error: 'order_not_cancelable',
  })
  assert.deepEqual(await call(client, 'get_order', { orderId: order.id }), canceled)
  await client.close()
})

test('the JSON Schema a client receives has plain date strings with a short description', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  assert.ok(!JSON.stringify(tools).includes('"pattern"'), 'a pattern is emitted')
  let dates = 0
  for (const tool of tools) {
    walk(tool.outputSchema, (node) => {
      const properties = (node.properties ?? {}) as Record<string, unknown>
      for (const name of ['createdAt', 'updatedAt']) {
        if (!(name in properties)) continue
        dates++
        assert.deepEqual(properties[name], { type: 'string', description: 'ISO 8601 UTC time' })
      }
    })
  }
  assert.equal(dates, 18)
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  assert.deepEqual(byName.add_cart_item?.inputSchema.properties?.quantity, {
    type: 'integer',
    minimum: 1,
    maximum: 99,
    description: 'How many to add, 1 to 99.',
  })
  await client.close()
})

test('a result that breaks the output schema is still refused', async () => {
  const bad: [string, Record<string, unknown>, (services: AcmeServices) => void][] = [
    [
      'get_product',
      { productId: 'prod_003' },
      (s) => {
        s.products.get = async () => ({ ...product, priceCents: 1.5 })
      },
    ],
    [
      'get_product',
      { productId: 'prod_003' },
      (s) => {
        s.products.get = async () => ({ ...product, stock: 2 ** 53 })
      },
    ],
  ]
  for (const [name, args, change] of bad) {
    const services = recordingServices().services
    change(services)
    const client = await connect(services)
    const outcome = await client.callTool({ name, arguments: args }).then(
      (result) => result.isError === true,
      () => true,
    )
    assert.equal(outcome, true, name)
    await client.close()
  }
})

test('search_products offers the categories as an enum of the core source', async () => {
  const client = await connect(recordingServices().services)
  const { tools } = await client.listTools()
  const search = tools.find((tool) => tool.name === 'search_products')
  const { category } = search?.inputSchema.properties ?? {}
  assert.deepEqual((category as { enum: string[] }).enum, [...CATEGORIES])
  await client.close()
})

test('the errors the descriptions promise for a wrong category, cursor or quantity hold', async () => {
  const client = await connect(createServices(createMemoryStore(), () => new Date()))
  const { tools } = await client.listTools()
  const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  const text = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: args })
    assert.equal(result.isError, true, name)
    return textOf(result)
  }

  assert.equal(
    await text('search_products', { category: 'toys' }),
    'Input validation error: Invalid arguments for tool search_products: category: Invalid option: expected one of "audio"|"computing"|"home"|"outdoors"',
  )
  const productCursor = await text('search_products', { category: 'audio', cursor: 'prod_010' })
  assert.equal(
    productCursor,
    'invalid_request: cursor: "prod_010" is not the id of a product in this list. Pass the nextCursor of the previous page, or no cursor for the first page',
  )
  assert.match(
    byName.search_products?.description ?? '',
    /invalid_request for a cursor that is not/,
  )
  const orderCursor = await text('list_orders', { cursor: 'order_9999' })
  assert.equal(
    orderCursor,
    'invalid_request: cursor: "order_9999" is not the id of an order. Pass the nextCursor of the previous page, or no cursor for the first page',
  )
  assert.match(byName.list_orders?.description ?? '', /invalid_request for a cursor that is not/)

  const { id: cartId } = (await call(client, 'create_cart', {})) as { id: string }
  await call(client, 'add_cart_item', { cartId, productId: 'prod_003', quantity: 99 })
  const over = await text('add_cart_item', { cartId, productId: 'prod_003', quantity: 1 })
  assert.equal(
    over,
    `invalid_request: quantity: cart ${cartId} would hold 100 of prod_003, the most is 99`,
  )
  assert.equal(
    await text('add_cart_item', { cartId, productId: 'prod_004', quantity: 100 }),
    'Input validation error: Invalid arguments for tool add_cart_item: quantity: Too big: expected number to be <=99',
  )
  assert.deepEqual(
    ((await call(client, 'get_cart', { cartId })) as Cart).items.map((item) => item.quantity),
    [99],
  )
  const addDescription = byName.add_cart_item?.description ?? ''
  assert.ok(addDescription.includes('A cart line holds at most 99'), addDescription)
  assert.ok(
    addDescription.includes(
      'invalid_request: quantity: cart cart_0001 would hold 100 of prod_003, the most is 99',
    ),
    addDescription,
  )
  await client.close()
})
