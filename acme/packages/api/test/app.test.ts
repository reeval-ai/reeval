import assert from 'node:assert/strict'
import { test } from 'node:test'
import { memoryStoresByKey } from '@acme/core'
import { createApp, tenantKeyFrom } from '../src/app.ts'

const KEY = 'acme_test_alpha'
const UNAUTHORIZED =
  'Missing or invalid API key: send "Authorization: Bearer <key>" with a key of at most 256 characters that is acme_test_ and then one or more letters, digits or the characters . _ ~ + / - (optionally ending in = padding), such as acme_test_demo; the CLI and the SDK send ACME_API_KEY this way'
const FIXED = new Date('2026-06-01T12:00:00.000Z')

function setup() {
  const app = createApp({ storeForKey: memoryStoresByKey(), clock: () => FIXED })
  async function call(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
    key = KEY,
  ) {
    const res = await app.request(path, {
      method,
      headers: {
        ...(key ? { authorization: `Bearer ${key}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: res.status, body: JSON.parse(await res.text()) }
  }
  return { app, call }
}

function authRequest(authorization: string): Request {
  return new Request('http://x', { headers: { authorization } })
}

async function cartWith(
  call: ReturnType<typeof setup>['call'],
  productId: string,
  quantity: number,
  key = KEY,
) {
  const cart = (await call('POST', '/v1/carts', undefined, {}, key)).body
  await call('POST', `/v1/carts/${cart.id}/items`, { productId, quantity }, {}, key)
  return cart.id as string
}

test('GET /health needs no auth', async () => {
  const { app } = setup()
  const res = await app.request('/health')
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { ok: true })
})

test('auth failures give 401 unauthorized', async () => {
  const { app } = setup()
  const bad = [undefined, 'Bearer nope', 'Bearer acme_test_', 'Basic acme_test_x', 'acme_test_x']
  for (const header of bad) {
    const res = await app.request('/v1/products', {
      headers: header ? { authorization: header } : {},
    })
    assert.equal(res.status, 401, String(header))
    const body = (await res.json()) as { error: { code: string } }
    assert.equal(body.error.code, 'unauthorized')
  }
})

test('tenantKeyFrom reads the bearer key', () => {
  const req = (value?: string) =>
    new Request('http://x', { headers: value ? { authorization: value } : {} })
  assert.equal(tenantKeyFrom(req('Bearer acme_test_a')), 'acme_test_a')
  assert.equal(tenantKeyFrom(req('Bearer acme_test_')), null)
  assert.equal(tenantKeyFrom(req()), null)
})

test('tenantKeyFrom takes the scheme in any case and one or more spaces', () => {
  for (const header of ['bearer acme_test_a', 'BEARER acme_test_a', 'Bearer   acme_test_a']) {
    assert.equal(tenantKeyFrom(authRequest(header)), 'acme_test_a', header)
  }
})

test('tenantKeyFrom refuses a key that is not a token68 of at most 256 characters', () => {
  const longest = `acme_test_${'k'.repeat(246)}`
  assert.equal(tenantKeyFrom(authRequest(`Bearer ${longest}`)), longest)
  for (const header of [
    `Bearer ${longest}k`,
    'Bearer ACME_TEST_a',
    'Bearer acme_test_a b',
    'Bearer acme_test_a\tb',
    'Bearer acme_test_é',
    'Bearer acme_test_a, Bearer acme_test_b',
  ]) {
    assert.equal(tenantKeyFrom(authRequest(header)), null, header)
  }
})

test('two Authorization headers give 401, not a tenant named after both', async () => {
  const { app } = setup()
  const headers = new Headers()
  headers.append('authorization', 'Bearer acme_test_a')
  headers.append('authorization', 'Bearer acme_test_b')
  const res = await app.request('/v1/products', { headers })
  assert.equal(res.status, 401)
})

test('a 401 on /v1 carries a Bearer challenge', async () => {
  const { app } = setup()
  const res = await app.request('/v1/products')
  assert.equal(res.status, 401)
  assert.equal(res.headers.get('www-authenticate'), 'Bearer')
})

test('the 401 message states the key rule and how to send it', async () => {
  const { app } = setup()
  for (const path of ['/v1/products', '/mcp']) {
    for (const key of ['sk_live_x', 'acme_test_a:b', 'acme_test_']) {
      const res = await app.request(path, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}` },
      })
      assert.equal(res.status, 401, `${path} ${key}`)
      assert.deepEqual(await res.json(), { error: { code: 'unauthorized', message: UNAUTHORIZED } })
    }
  }
})

test('an unknown query or body field gives 400 invalid_request naming the field', async () => {
  const { call } = setup()
  const cartId = await cartWith(call, 'prod_003', 1)
  const requests: [Awaited<ReturnType<typeof call>>, string][] = [
    [await call('GET', '/v1/products?query=lamp'), 'query'],
    [await call('GET', '/v1/orders?sort=desc'), 'sort'],
    [
      await call('POST', `/v1/carts/${cartId}/items`, {
        productId: 'prod_003',
        quantity: 1,
        qty: 1,
      }),
      'qty',
    ],
    [await call('PATCH', `/v1/carts/${cartId}/items/prod_003`, { quantity: 2, x: 1 }), 'x'],
    [
      await call('POST', '/v1/orders', { cartId, paymentToken: 'tok_ok', coupon: 'SAVE5' }),
      'coupon',
    ],
  ]
  for (const [res, field] of requests) {
    assert.equal(res.status, 400, field)
    assert.deepEqual(res.body, {
      error: { code: 'invalid_request', message: `Unrecognized key: "${field}"` },
    })
  }
  assert.equal((await call('GET', `/v1/carts/${cartId}`)).body.items[0].quantity, 1)
})

test('the Idempotency-Key header is not an unknown field of the order', async () => {
  const { call } = setup()
  const cartId = await cartWith(call, 'prod_003', 1)
  const headers = { 'idempotency-key': 'k1' }
  const first = await call('POST', '/v1/orders', { cartId, paymentToken: 'tok_ok' }, headers)
  assert.equal(first.status, 201)
  const inBody = await call('POST', '/v1/orders', {
    cartId,
    paymentToken: 'tok_ok',
    idempotencyKey: 'k1',
  })
  assert.deepEqual(inBody, first)
})

test('a category outside the seed categories gives 400 listing the valid ones', async () => {
  const { call } = setup()
  const res = await call('GET', '/v1/products?category=toys')
  assert.equal(res.status, 400)
  assert.deepEqual(res.body.error, {
    code: 'invalid_request',
    message: 'category: Invalid option: expected one of "audio"|"computing"|"home"|"outdoors"',
  })
})

test('an unknown cursor gives 400 on both lists, and returned cursors page to the end', async () => {
  const { call } = setup()
  const products = await call('GET', '/v1/products?cursor=prod_999')
  assert.equal(products.status, 400)
  assert.match(products.body.error.message, /^cursor: "prod_999" is not the id of a product/)
  const orders = await call('GET', '/v1/orders?status=paid&cursor=order_0009')
  assert.equal(orders.status, 400)
  assert.match(orders.body.error.message, /^cursor: "order_0009" is not the id of an order/)

  const ids: string[] = []
  let cursor: string | null = null
  do {
    const res: Awaited<ReturnType<typeof call>> = await call(
      'GET',
      `/v1/products?category=home&limit=4${cursor ? `&cursor=${cursor}` : ''}`,
    )
    assert.equal(res.status, 200)
    ids.push(...res.body.data.map((p: { id: string }) => p.id))
    cursor = res.body.nextCursor
  } while (cursor)
  assert.deepEqual(ids, ['prod_013', 'prod_014', 'prod_015', 'prod_016', 'prod_017', 'prod_018'])
})

test('a free string or id over 255 characters gives 400', async () => {
  const { call } = setup()
  const long = 'x'.repeat(256)
  for (const [method, path, body] of [
    ['GET', `/v1/products?q=${long}`],
    ['GET', `/v1/products?cursor=${long}`],
    ['GET', `/v1/products/${long}`],
    ['GET', `/v1/carts/${long}`],
    ['GET', `/v1/orders/${long}`],
    ['POST', `/v1/orders/${long}/cancel`],
    ['POST', '/v1/orders', { cartId: 'cart_0001', paymentToken: long }],
  ] as const) {
    const res = await call(method, path, body)
    assert.equal(res.status, 400, path)
    assert.match(res.body.error.message, /: Too big: expected string to have <=255 characters$/)
  }
})

test('limit in a query string takes decimal digits only', async () => {
  const { call } = setup()
  for (const path of ['/v1/products', '/v1/orders']) {
    for (const limit of ['1e1', '0x10', '5.0', '%205', '5%20', '', '%2B5', '-5', '%D9%A5']) {
      const res = await call('GET', `${path}?limit=${limit}`)
      assert.equal(res.status, 400, `${path} ${limit}`)
      assert.deepEqual(res.body.error, {
        code: 'invalid_request',
        message: 'limit: Expected an integer in decimal digits, such as 10',
      })
    }
  }
  const five = await call('GET', '/v1/products?limit=5')
  assert.equal(five.status, 200)
  assert.equal(five.body.data.length, 5)
  assert.equal((await call('GET', '/v1/orders?limit=050')).status, 200)
  assert.equal((await call('GET', '/v1/orders?limit=51')).status, 400)
})

test('a body over 64 KiB gives 413 invalid_request', async () => {
  const { app } = setup()
  const res = await app.request('/v1/carts/cart_0001/items', {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 'prod_001', quantity: 1, pad: 'x'.repeat(64 * 1024) }),
  })
  assert.equal(res.status, 413)
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'invalid_request')
})

test('a body over 64 KiB without a Content-Length gives 413', async () => {
  const { app } = setup()
  const chunk = new TextEncoder().encode('x'.repeat(16 * 1024))
  let sent = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent++ < 5) controller.enqueue(chunk)
      else controller.close()
    },
  })
  const res = await app.request('/v1/orders', {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body,
    duplex: 'half',
  } as RequestInit)
  assert.equal(res.status, 413)
})

test('products: list, filter, get', async () => {
  const { call } = setup()
  const list = await call('GET', '/v1/products?category=audio&limit=2')
  assert.equal(list.status, 200)
  assert.equal(list.body.data.length, 2)
  assert.equal(list.body.nextCursor, 'prod_002')
  const q = await call('GET', '/v1/products?q=headphones')
  assert.equal(q.body.data[0].id, 'prod_001')
  const one = await call('GET', '/v1/products/prod_003')
  assert.equal(one.status, 200)
  assert.equal(one.body.id, 'prod_003')
})

test('products paginate over three pages', async () => {
  const { call } = setup()
  const ids: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const res: Awaited<ReturnType<typeof call>> = await call(
      'GET',
      `/v1/products${cursor ? `?cursor=${cursor}` : ''}`,
    )
    pages++
    ids.push(...res.body.data.map((p: { id: string }) => p.id))
    cursor = res.body.nextCursor
  } while (cursor)
  assert.equal(pages, 3)
  assert.equal(ids.length, 24)
})

test('carts: create, get, add, update, remove', async () => {
  const { call } = setup()
  const created = await call('POST', '/v1/carts')
  assert.equal(created.status, 201)
  assert.equal(created.body.id, 'cart_0001')
  assert.equal(created.body.createdAt, FIXED.toISOString())
  const added = await call('POST', '/v1/carts/cart_0001/items', {
    productId: 'prod_003',
    quantity: 2,
  })
  assert.equal(added.status, 200)
  assert.equal(added.body.subtotalCents, 11800)
  const updated = await call('PATCH', '/v1/carts/cart_0001/items/prod_003', { quantity: 1 })
  assert.equal(updated.status, 200)
  assert.equal(updated.body.items[0].quantity, 1)
  const got = await call('GET', '/v1/carts/cart_0001')
  assert.equal(got.body.subtotalCents, 5900)
  const removed = await call('DELETE', '/v1/carts/cart_0001/items/prod_003')
  assert.equal(removed.status, 200)
  assert.deepEqual(removed.body.items, [])
})

test('orders: create, get, list, cancel', async () => {
  const { call } = setup()
  const cartId = await cartWith(call, 'prod_003', 2)
  const created = await call('POST', '/v1/orders', {
    cartId,
    paymentToken: 'tok_ok',
    couponCode: 'WELCOME10',
  })
  assert.equal(created.status, 201)
  assert.equal(created.body.id, 'order_0003')
  assert.equal(created.body.totalCents, 10620)
  assert.equal((await call('GET', '/v1/orders/order_0003')).status, 200)
  const list = await call('GET', '/v1/orders?status=paid')
  assert.deepEqual(
    list.body.data.map((o: { id: string }) => o.id),
    ['order_0001', 'order_0003'],
  )
  const canceled = await call('POST', '/v1/orders/order_0003/cancel')
  assert.equal(canceled.status, 200)
  assert.equal(canceled.body.status, 'canceled')
})

test('idempotency key replays the first order', async () => {
  const { call } = setup()
  const cartId = await cartWith(call, 'prod_003', 1)
  const headers = { 'idempotency-key': 'k1' }
  const first = await call('POST', '/v1/orders', { cartId, paymentToken: 'tok_ok' }, headers)
  const second = await call('POST', '/v1/orders', { cartId, paymentToken: 'tok_ok' }, headers)
  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  assert.deepEqual(second.body, first.body)
  const list = await call('GET', '/v1/orders')
  assert.equal(list.body.data.length, 3)
  const noKey = await call('POST', '/v1/orders', { cartId, paymentToken: 'tok_ok' })
  assert.equal(noKey.body.error.code, 'cart_empty')
})

test('reset restores the seed data of the key', async () => {
  const { call } = setup()
  await cartWith(call, 'prod_003', 1)
  const reset = await call('POST', '/v1/reset')
  assert.equal(reset.status, 200)
  assert.deepEqual(reset.body, { ok: true })
  assert.equal((await call('GET', '/v1/carts/cart_0001')).status, 404)
})

test('tenants do not see each other', async () => {
  const { call } = setup()
  const id = await cartWith(call, 'prod_003', 1)
  const other = await call('GET', `/v1/carts/${id}`, undefined, {}, 'acme_test_beta')
  assert.equal(other.status, 404)
  await call('POST', '/v1/reset', undefined, {}, 'acme_test_beta')
  assert.equal((await call('GET', `/v1/carts/${id}`)).status, 200)
})

test('every error code has its status', async () => {
  const { call, app } = setup()
  const expectError = (
    res: { status: number; body: { error: { code: string; message: string } } },
    status: number,
    code: string,
  ) => {
    assert.equal(res.status, status, code)
    assert.equal(res.body.error.code, code)
    assert.equal(typeof res.body.error.message, 'string')
  }
  expectError(await call('GET', '/v1/products/nope'), 404, 'not_found')
  expectError(await call('GET', '/v1/nope'), 404, 'not_found')
  expectError(await call('GET', '/v1/products?limit=0'), 400, 'invalid_request')
  expectError(
    await call('POST', '/v1/carts/cart_0001/items', { productId: 1 }),
    400,
    'invalid_request',
  )

  const emptyId = await cartWith(call, 'prod_003', 1)
  await call('DELETE', `/v1/carts/${emptyId}/items/prod_003`)
  expectError(
    await call('POST', '/v1/orders', { cartId: emptyId, paymentToken: 'tok_ok' }),
    409,
    'cart_empty',
  )

  const stock = await cartWith(call, 'prod_005', 1)
  expectError(
    await call('POST', '/v1/orders', { cartId: stock, paymentToken: 'tok_ok' }),
    409,
    'insufficient_stock',
  )

  const pay = await cartWith(call, 'prod_003', 1)
  expectError(
    await call('POST', '/v1/orders', { cartId: pay, paymentToken: 'tok_declined' }),
    402,
    'payment_declined',
  )
  expectError(
    await call('POST', '/v1/orders', {
      cartId: pay,
      paymentToken: 'tok_ok',
      couponCode: 'EXPIRED20',
    }),
    422,
    'coupon_invalid',
  )
  expectError(await call('POST', '/v1/orders/order_0002/cancel'), 409, 'order_not_cancelable')

  const res = await app.request('/v1/products')
  expectError({ status: res.status, body: JSON.parse(await res.text()) }, 401, 'unauthorized')
})

test('a malformed JSON body gives 400 invalid_request', async () => {
  const { app } = setup()
  const res = await app.request('/v1/carts/cart_0001/items', {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: '{not json',
  })
  assert.equal(res.status, 400)
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'invalid_request')
})

test('an unknown route outside /v1 gives 404 not_found', async () => {
  const { app } = setup()
  const res = await app.request('/nope')
  assert.equal(res.status, 404)
  assert.equal(((await res.json()) as { error: { code: string } }).error.code, 'not_found')
})

test('an unexpected failure gives a generic 500', async () => {
  const app = createApp({
    storeForKey() {
      throw new Error('secret detail')
    },
  })
  const original = console.error
  console.error = () => {}
  try {
    const res = await app.request('/v1/products', { headers: { authorization: `Bearer ${KEY}` } })
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), {
      error: { code: 'internal_error', message: 'Internal server error' },
    })
  } finally {
    console.error = original
  }
})
