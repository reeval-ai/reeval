import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Acme, AcmeConnectionError, AcmeError, type AcmeServices, isAcmeError } from '@acme/sdk'

// Compile-time: the client satisfies the contract.
const _contract: AcmeServices = null as unknown as Acme
void _contract

interface Seen {
  method: string
  url: URL
  headers: Headers
  body: unknown
}

function stub(respond: () => Response = () => json({ ok: true })) {
  const seen: Seen[] = []
  const fetchStub: typeof fetch = async (input, init) => {
    const raw = init?.body
    seen.push({
      method: init?.method ?? 'GET',
      url: new URL(input instanceof Request ? input.url : String(input)),
      headers: new Headers(init?.headers),
      body: typeof raw === 'string' ? JSON.parse(raw) : undefined,
    })
    return respond()
  }
  const acme = new Acme({ apiKey: 'acme_test_k', baseUrl: 'http://x.test', fetch: fetchStub })
  return { acme, seen }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('products.list sends only the set query params', async () => {
  const { acme, seen } = stub(() => json({ data: [], nextCursor: null }))
  const page = await acme.products.list({ q: 'a b', category: 'audio', limit: 5 })
  assert.deepEqual(page, { data: [], nextCursor: null })
  const [req] = seen
  assert.equal(req?.method, 'GET')
  assert.equal(req?.url.pathname, '/v1/products')
  assert.deepEqual(Object.fromEntries(req?.url.searchParams ?? []), {
    q: 'a b',
    category: 'audio',
    limit: '5',
  })
  assert.equal(req?.headers.get('authorization'), 'Bearer acme_test_k')
  assert.equal(req?.body, undefined)
})

test('products.list with no input has no query', async () => {
  const { acme, seen } = stub()
  await acme.products.list()
  assert.equal(seen[0]?.url.search, '')
})

test('products.get', async () => {
  const { acme, seen } = stub(() => json({ id: 'prod_001' }))
  assert.deepEqual(await acme.products.get('prod_001'), { id: 'prod_001' })
  assert.equal(seen[0]?.method, 'GET')
  assert.equal(seen[0]?.url.pathname, '/v1/products/prod_001')
})

test('carts.create and carts.get', async () => {
  const { acme, seen } = stub(() => json({ id: 'cart_0001' }))
  assert.deepEqual(await acme.carts.create(), { id: 'cart_0001' })
  await acme.carts.get('cart_0001')
  assert.equal(seen[0]?.method, 'POST')
  assert.equal(seen[0]?.url.pathname, '/v1/carts')
  assert.equal(seen[0]?.body, undefined)
  assert.equal(seen[0]?.headers.get('content-type'), null)
  assert.equal(seen[1]?.method, 'GET')
  assert.equal(seen[1]?.url.pathname, '/v1/carts/cart_0001')
})

test('carts.addItem posts the item', async () => {
  const { acme, seen } = stub(() => json({ id: 'cart_0001' }))
  await acme.carts.addItem('cart_0001', { productId: 'prod_003', quantity: 2 })
  assert.equal(seen[0]?.method, 'POST')
  assert.equal(seen[0]?.url.pathname, '/v1/carts/cart_0001/items')
  assert.deepEqual(seen[0]?.body, { productId: 'prod_003', quantity: 2 })
  assert.equal(seen[0]?.headers.get('content-type'), 'application/json')
})

test('carts.updateItem patches the quantity', async () => {
  const { acme, seen } = stub(() => json({ id: 'cart_0001' }))
  await acme.carts.updateItem('cart_0001', 'prod_003', { quantity: 4 })
  assert.equal(seen[0]?.method, 'PATCH')
  assert.equal(seen[0]?.url.pathname, '/v1/carts/cart_0001/items/prod_003')
  assert.deepEqual(seen[0]?.body, { quantity: 4 })
})

test('carts.removeItem returns the cart', async () => {
  const { acme, seen } = stub(() => json({ id: 'cart_0001', items: [] }))
  assert.deepEqual(await acme.carts.removeItem('cart_0001', 'prod_003'), {
    id: 'cart_0001',
    items: [],
  })
  assert.equal(seen[0]?.method, 'DELETE')
  assert.equal(seen[0]?.url.pathname, '/v1/carts/cart_0001/items/prod_003')
  assert.equal(seen[0]?.body, undefined)
})

test('orders.create keeps the idempotency key out of the body', async () => {
  const { acme, seen } = stub(() => json({ id: 'order_0003' }, 201))
  const order = await acme.orders.create({
    cartId: 'cart_0001',
    paymentToken: 'tok_ok',
    couponCode: 'SAVE5',
    idempotencyKey: 'key-1',
  })
  assert.deepEqual(order, { id: 'order_0003' })
  assert.equal(seen[0]?.method, 'POST')
  assert.equal(seen[0]?.url.pathname, '/v1/orders')
  assert.deepEqual(seen[0]?.body, {
    cartId: 'cart_0001',
    paymentToken: 'tok_ok',
    couponCode: 'SAVE5',
  })
  assert.equal(seen[0]?.headers.get('idempotency-key'), 'key-1')
})

test('orders.create without a key or coupon sends neither', async () => {
  const { acme, seen } = stub()
  await acme.orders.create({ cartId: 'cart_0001', paymentToken: 'tok_ok' })
  assert.deepEqual(seen[0]?.body, { cartId: 'cart_0001', paymentToken: 'tok_ok' })
  assert.equal(seen[0]?.headers.has('idempotency-key'), false)
})

test('orders.list, get and cancel', async () => {
  const { acme, seen } = stub(() => json({ id: 'order_0001' }))
  await acme.orders.list({ cursor: 'order_0001', limit: 2, status: 'paid' })
  await acme.orders.list()
  await acme.orders.get('order_0001')
  await acme.orders.cancel('order_0001')
  assert.equal(seen[0]?.method, 'GET')
  assert.equal(seen[0]?.url.pathname, '/v1/orders')
  assert.deepEqual(Object.fromEntries(seen[0]?.url.searchParams ?? []), {
    cursor: 'order_0001',
    limit: '2',
    status: 'paid',
  })
  assert.equal(seen[1]?.url.search, '')
  assert.equal(seen[2]?.method, 'GET')
  assert.equal(seen[2]?.url.pathname, '/v1/orders/order_0001')
  assert.equal(seen[3]?.method, 'POST')
  assert.equal(seen[3]?.url.pathname, '/v1/orders/order_0001/cancel')
})

test('reset', async () => {
  const { acme, seen } = stub(() => json({ ok: true }))
  assert.deepEqual(await acme.reset(), { ok: true })
  assert.equal(seen[0]?.method, 'POST')
  assert.equal(seen[0]?.url.pathname, '/v1/reset')
})

test('path segments are encoded', async () => {
  const { acme, seen } = stub()
  await acme.carts.updateItem('a/b?c', 'x y#z', { quantity: 1 })
  assert.equal(seen[0]?.url.pathname, '/v1/carts/a%2Fb%3Fc/items/x%20y%23z')
  assert.equal(seen[0]?.url.search, '')
})

test('an envelope error becomes an AcmeError with code and status', async () => {
  const { acme } = stub(() =>
    json({ error: { code: 'not_found', message: 'Product prod_999 not found' } }, 404),
  )
  await assert.rejects(acme.products.get('prod_999'), (error) => {
    assert.ok(error instanceof AcmeError)
    assert.ok(isAcmeError(error))
    assert.equal(error.code, 'not_found')
    assert.equal(error.status, 404)
    assert.equal(error.message, 'Product prod_999 not found')
    return true
  })
})

test('a non-envelope error response becomes an AcmeConnectionError', async () => {
  const { acme } = stub(() => json({ message: 'boom' }, 500))
  await assert.rejects(acme.reset(), (error) => {
    assert.ok(error instanceof AcmeConnectionError)
    assert.equal(error.status, 500)
    return true
  })
})

test('a non-JSON response becomes an AcmeConnectionError', async () => {
  for (const status of [200, 502]) {
    const { acme } = stub(() => new Response('<html>', { status }))
    await assert.rejects(acme.reset(), (error) => {
      assert.ok(error instanceof AcmeConnectionError)
      assert.equal(error.status, status)
      assert.ok(error.cause)
      return true
    })
  }
})

test('a rejected fetch becomes an AcmeConnectionError with the cause', async () => {
  const cause = new TypeError('fetch failed')
  const acme = new Acme({
    apiKey: 'acme_test_k',
    fetch: async () => {
      throw cause
    },
  })
  await assert.rejects(acme.reset(), (error) => {
    assert.ok(error instanceof AcmeConnectionError)
    assert.equal(error.status, undefined)
    assert.equal(error.cause, cause)
    return true
  })
})

test('a connection error message names the reason fetch hides in its cause', async () => {
  const refused = new AggregateError(
    [new Error('connect ECONNREFUSED ::1:8787'), new Error('connect ECONNREFUSED 127.0.0.1:8787')],
    '',
  )
  const acme = new Acme({
    apiKey: 'acme_test_k',
    baseUrl: 'http://localhost:8787',
    fetch: async () => {
      throw new TypeError('fetch failed', { cause: refused })
    },
  })
  await assert.rejects(acme.reset(), {
    name: 'AcmeConnectionError',
    message:
      'POST http://localhost:8787/v1/reset failed: fetch failed: connect ECONNREFUSED ::1:8787, connect ECONNREFUSED 127.0.0.1:8787',
  })
})

test('an empty error body becomes an AcmeConnectionError', async () => {
  const { acme } = stub(() => new Response(null, { status: 503 }))
  await assert.rejects(acme.reset(), (error) => {
    assert.ok(error instanceof AcmeConnectionError)
    assert.equal(error.status, 503)
    return true
  })
})

test('a key an HTTP header cannot carry throws at construction without quoting the key', () => {
  for (const apiKey of ['acme_test_sec\nret', 'acme_test_sec\0ret', 'acme_test_€']) {
    assert.throws(
      () => new Acme({ apiKey, fetch: async () => json({ ok: true }) }),
      (error) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /ACME_API_KEY/)
        assert.doesNotMatch(error.message, /sec|€/)
        return true
      },
    )
  }
})

test('a base URL that is not http or https throws at construction', () => {
  for (const baseUrl of ['localhost:8787', 'not a url', 'ftp://x.test', 'http://x.test?a=1']) {
    assert.throws(() => new Acme({ apiKey: 'acme_test_k', baseUrl }), {
      message: new RegExp(`ACME_BASE_URL \\(got "${baseUrl.replace(/[?.]/g, '\\$&')}"\\)$`),
    })
  }
})

test('baseUrl keeps its path and drops a trailing slash', async () => {
  const seen: Seen[] = []
  const other = new Acme({
    apiKey: 'k',
    baseUrl: 'http://y.test/base/',
    fetch: async (input) => {
      seen.push({
        method: '',
        url: new URL(String(input)),
        headers: new Headers(),
        body: undefined,
      })
      return json({ ok: true })
    },
  })
  await other.reset()
  assert.equal(seen[0]?.url.href, 'http://y.test/base/v1/reset')
})

test('apiKey and baseUrl default from the environment, then localhost', async (t) => {
  const saved = { key: process.env.ACME_API_KEY, url: process.env.ACME_BASE_URL }
  t.after(() => {
    for (const [name, value] of [
      ['ACME_API_KEY', saved.key],
      ['ACME_BASE_URL', saved.url],
    ] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })
  const urls: string[] = []
  const auth: (string | null)[] = []
  const fetchStub: typeof fetch = async (input, init) => {
    urls.push(String(input))
    auth.push(new Headers(init?.headers).get('authorization'))
    return json({ ok: true })
  }

  process.env.ACME_API_KEY = 'acme_test_env'
  process.env.ACME_BASE_URL = 'http://env.test'
  await new Acme({ fetch: fetchStub }).reset()

  delete process.env.ACME_BASE_URL
  await new Acme({ fetch: fetchStub }).reset()

  assert.deepEqual(urls, ['http://env.test/v1/reset', 'http://localhost:8787/v1/reset'])
  assert.deepEqual(auth, ['Bearer acme_test_env', 'Bearer acme_test_env'])
})

test('a missing API key throws at construction', (t) => {
  const saved = process.env.ACME_API_KEY
  t.after(() => {
    if (saved !== undefined) process.env.ACME_API_KEY = saved
  })
  delete process.env.ACME_API_KEY
  assert.throws(() => new Acme(), /API key/)
})

test('the class loads and works where process does not exist', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'process')
  assert.ok(original)
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true })
  try {
    assert.throws(() => new Acme(), /API key/)
    const acme = new Acme({ apiKey: 'k', fetch: async () => json({ ok: true }) })
    assert.deepEqual(await acme.reset(), { ok: true })
  } finally {
    Object.defineProperty(globalThis, 'process', original)
  }
})

test('unknown fields reach the server, so it refuses them instead of the SDK dropping them', async () => {
  const { acme, seen } = stub()
  const list = { q: 'lamp', query: 'lamp' }
  const item = { productId: 'prod_003', quantity: 1, qty: 2 }
  const update = { quantity: 2, note: 'gift' }
  const order = {
    cartId: 'cart_0001',
    paymentToken: 'tok_ok',
    coupon: 'SAVE5',
    idempotencyKey: 'k',
  }
  const orders = { status: 'paid' as const, sort: 'desc' }
  await acme.products.list(list)
  await acme.carts.addItem('cart_0001', item)
  await acme.carts.updateItem('cart_0001', 'prod_003', update)
  await acme.orders.create(order)
  await acme.orders.list(orders)
  assert.deepEqual(Object.fromEntries(seen[0]?.url.searchParams ?? []), list)
  assert.deepEqual(seen[1]?.body, item)
  assert.deepEqual(seen[2]?.body, update)
  assert.deepEqual(seen[3]?.body, { cartId: 'cart_0001', paymentToken: 'tok_ok', coupon: 'SAVE5' })
  assert.equal(seen[3]?.headers.get('idempotency-key'), 'k')
  assert.deepEqual(Object.fromEntries(seen[4]?.url.searchParams ?? []), orders)
})

/** A `fetch` that never answers on its own and rejects as `fetch` does when its signal aborts. */
function hanging(signals: (AbortSignal | undefined)[] = []): typeof fetch {
  return (_input, init) => {
    const signal = init?.signal ?? undefined
    signals.push(signal)
    return new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(signal.reason))
    })
  }
}

test('a request past timeoutMs rejects with an AcmeConnectionError naming the method and URL', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const acme = new Acme({
    apiKey: 'acme_test_k',
    baseUrl: 'http://x.test',
    fetch: hanging(),
    timeoutMs: 250,
  })
  let settled = false
  const result = acme.carts.get('cart_0001').then(
    () => 'resolved',
    (error: unknown) => error,
  )
  void result.finally(() => {
    settled = true
  })
  t.mock.timers.tick(249)
  await new Promise(setImmediate)
  assert.equal(settled, false)
  t.mock.timers.tick(1)
  const error = await result
  assert.ok(error instanceof AcmeConnectionError)
  assert.equal(error.message, 'GET http://x.test/v1/carts/cart_0001 timed out after 250 ms')
  assert.equal(error.status, undefined)
  assert.ok(error.cause)
})

test('timeoutMs defaults to 30000 and also covers a body that never ends', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const acme = new Acme({
    apiKey: 'acme_test_k',
    baseUrl: 'http://x.test',
    fetch: async (_input, init) =>
      new Response(
        new ReadableStream({
          start(controller) {
            init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason))
          },
        }),
      ),
  })
  const result = acme.reset().catch((error: unknown) => error)
  await new Promise(setImmediate)
  t.mock.timers.tick(29_999)
  await new Promise(setImmediate)
  t.mock.timers.tick(1)
  const error = await result
  assert.ok(error instanceof AcmeConnectionError)
  assert.equal(error.message, 'POST http://x.test/v1/reset timed out after 30000 ms')
})

test('a settled request leaves no timer, and timeoutMs 0 sends no signal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const signals: (AbortSignal | undefined)[] = []
  const answering: typeof fetch = async (_input, init) => {
    signals.push(init?.signal ?? undefined)
    return json({ ok: true })
  }
  const timed = new Acme({ apiKey: 'acme_test_k', fetch: answering, timeoutMs: 100 })
  assert.deepEqual(await timed.reset(), { ok: true })
  t.mock.timers.tick(1_000)
  assert.equal(signals[0]?.aborted, false)

  const untimed = new Acme({ apiKey: 'acme_test_k', fetch: hanging(signals), timeoutMs: 0 })
  let settled = false
  void untimed.reset().finally(() => {
    settled = true
  })
  t.mock.timers.tick(10 * 60_000)
  await new Promise(setImmediate)
  assert.equal(settled, false)
  assert.equal(signals[1], undefined)
})

test('a timeoutMs that is not an integer from 0 to 2147483647 throws at construction', () => {
  for (const timeoutMs of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 31]) {
    assert.throws(() => new Acme({ apiKey: 'acme_test_k', timeoutMs }), {
      message: `Acme needs a timeoutMs that is an integer from 0 to 2147483647, where 0 means no timeout (got ${timeoutMs})`,
    })
  }
})
