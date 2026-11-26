import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  type AcmeError,
  type AcmeServices,
  createMemoryStore,
  createServices,
  isAcmeError,
  seedState,
} from '../src/index.ts'

const NOW = '2026-06-01T12:00:00.000Z'

function setup() {
  const store = createMemoryStore()
  const acme = createServices(store, () => new Date(NOW))
  return { store, acme }
}

async function rejection(promise: Promise<unknown>): Promise<AcmeError> {
  try {
    await promise
  } catch (error) {
    assert.ok(isAcmeError(error), `expected an AcmeError, got ${String(error)}`)
    return error
  }
  throw new Error('expected a rejection')
}

async function cartWith(acme: AcmeServices, productId: string, quantity: number) {
  const cart = await acme.carts.create()
  await acme.carts.addItem(cart.id, { productId, quantity })
  return cart.id
}

test('products.list returns the first page of the catalog', async () => {
  const { acme } = setup()
  const page = await acme.products.list()
  assert.equal(page.data.length, 10)
  assert.equal(page.data[0]?.id, 'prod_001')
  assert.equal(page.nextCursor, 'prod_010')
})

test('products.list pages through all 24 products in three pages', async () => {
  const { acme } = setup()
  const ids: string[] = []
  let cursor: string | undefined
  let pages = 0
  do {
    const page = await acme.products.list({ cursor })
    ids.push(...page.data.map((product) => product.id))
    cursor = page.nextCursor ?? undefined
    pages++
  } while (cursor)
  assert.equal(pages, 3)
  assert.equal(ids.length, 24)
  assert.equal(new Set(ids).size, 24)
  assert.equal(ids[23], 'prod_024')
})

test('products.list honors limit, category and q', async () => {
  const { acme } = setup()
  assert.equal((await acme.products.list({ limit: 4 })).data.length, 4)
  const audio = await acme.products.list({ category: 'audio' })
  assert.equal(audio.data.length, 6)
  assert.equal(audio.nextCursor, null)
  const found = await acme.products.list({ q: 'KEYBOARD' })
  assert.deepEqual(
    found.data.map((product) => product.id),
    ['prod_007'],
  )
})

test('products.list has two products with no stock and four categories', async () => {
  const { acme } = setup()
  const all = (await acme.products.list({ limit: 50 })).data
  assert.equal(all.filter((product) => product.stock === 0).length, 2)
  assert.equal(new Set(all.map((product) => product.category)).size, 4)
})

test('products.get returns a product with its stock', async () => {
  const { acme } = setup()
  const product = await acme.products.get('prod_003')
  assert.equal(product.name, 'Bluetooth Speaker')
  assert.equal(product.priceCents, 5900)
  assert.equal(product.stock, 30)
})

test('carts.create gives deterministic ids and time', async () => {
  const { acme } = setup()
  const first = await acme.carts.create()
  const second = await acme.carts.create()
  assert.deepEqual(first, {
    id: 'cart_0001',
    items: [],
    subtotalCents: 0,
    createdAt: NOW,
    updatedAt: NOW,
  })
  assert.equal(second.id, 'cart_0002')
})

test('carts.addItem prices the cart and adds to an existing line', async () => {
  const { acme } = setup()
  const cart = await acme.carts.create()
  await acme.carts.addItem(cart.id, { productId: 'prod_003', quantity: 2 })
  const updated = await acme.carts.addItem(cart.id, { productId: 'prod_003', quantity: 1 })
  assert.deepEqual(updated.items, [
    {
      productId: 'prod_003',
      name: 'Bluetooth Speaker',
      unitPriceCents: 5900,
      quantity: 3,
      lineTotalCents: 17700,
    },
  ])
  assert.equal(updated.subtotalCents, 17700)
  assert.deepEqual(await acme.carts.get(cart.id), updated)
})

test('carts.updateItem sets the quantity', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const cart = await acme.carts.updateItem(cartId, 'prod_003', { quantity: 5 })
  assert.equal(cart.items[0]?.quantity, 5)
  assert.equal(cart.subtotalCents, 29500)
})

test('carts.removeItem removes the line', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const cart = await acme.carts.removeItem(cartId, 'prod_003')
  assert.deepEqual(cart.items, [])
  assert.equal(cart.subtotalCents, 0)
})

test('orders.create checks out a cart and decrements stock', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const order = await acme.orders.create({ cartId, paymentToken: 'tok_ok' })
  assert.equal(order.id, 'order_0003')
  assert.equal(order.status, 'paid')
  assert.equal(order.subtotalCents, 11800)
  assert.equal(order.discountCents, 0)
  assert.equal(order.totalCents, 11800)
  assert.equal(order.couponCode, null)
  assert.equal(order.createdAt, NOW)
  assert.equal((await acme.products.get('prod_003')).stock, 28)
  assert.deepEqual((await acme.carts.get(cartId)).items, [])
  assert.deepEqual(await acme.orders.get(order.id), order)
})

test('orders.create applies a percent coupon', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const order = await acme.orders.create({
    cartId,
    paymentToken: 'tok_ok',
    couponCode: 'WELCOME10',
  })
  assert.equal(order.discountCents, 1180)
  assert.equal(order.totalCents, 10620)
  assert.equal(order.couponCode, 'WELCOME10')
})

test('orders.create applies a fixed coupon above its minimum spend', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const order = await acme.orders.create({ cartId, paymentToken: 'tok_ok', couponCode: 'SAVE5' })
  assert.equal(order.discountCents, 500)
  assert.equal(order.totalCents, 11300)
})

test('orders.create with a repeated idempotencyKey returns the first order', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const input = { cartId, paymentToken: 'tok_ok', idempotencyKey: 'key-1' }
  const first = await acme.orders.create(input)
  const again = await acme.orders.create(input)
  assert.deepEqual(again, first)
  assert.equal((await acme.orders.list({ limit: 50 })).data.length, 3)
  assert.equal((await acme.products.get('prod_003')).stock, 28)
})

test('orders.create with different idempotency keys makes separate orders', async () => {
  const { acme } = setup()
  const first = await acme.orders.create({
    cartId: await cartWith(acme, 'prod_003', 1),
    paymentToken: 'tok_ok',
    idempotencyKey: 'a',
  })
  const second = await acme.orders.create({
    cartId: await cartWith(acme, 'prod_003', 1),
    paymentToken: 'tok_ok',
    idempotencyKey: 'b',
  })
  assert.notEqual(first.id, second.id)
})

test('orders.list returns the seeded orders and filters by status', async () => {
  const { acme } = setup()
  const all = await acme.orders.list()
  assert.deepEqual(
    all.data.map((order) => [order.id, order.status]),
    [
      ['order_0001', 'paid'],
      ['order_0002', 'shipped'],
    ],
  )
  const shipped = await acme.orders.list({ status: 'shipped' })
  assert.deepEqual(
    shipped.data.map((order) => order.id),
    ['order_0002'],
  )
})

test('orders.list pages with a cursor', async () => {
  const { acme } = setup()
  const first = await acme.orders.list({ limit: 1 })
  assert.deepEqual(
    first.data.map((order) => order.id),
    ['order_0001'],
  )
  assert.equal(first.nextCursor, 'order_0001')
  const second = await acme.orders.list({ limit: 1, cursor: first.nextCursor ?? undefined })
  assert.deepEqual(
    second.data.map((order) => order.id),
    ['order_0002'],
  )
  assert.equal(second.nextCursor, null)
})

test('orders.cancel cancels a paid order and returns its stock', async () => {
  const { acme } = setup()
  const before = (await acme.products.get('prod_001')).stock
  const order = await acme.orders.cancel('order_0001')
  assert.equal(order.status, 'canceled')
  assert.equal(order.updatedAt, NOW)
  assert.equal((await acme.products.get('prod_001')).stock, before + 1)
  assert.equal((await acme.orders.get('order_0001')).status, 'canceled')
})

test('reset restores the seed data', async () => {
  const { acme, store } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  await acme.orders.create({ cartId, paymentToken: 'tok_ok', idempotencyKey: 'k' })
  await acme.orders.cancel('order_0001')
  assert.deepEqual(await acme.reset(), { ok: true })
  assert.deepEqual(await store.read(), seedState())
  assert.equal((await acme.carts.create()).id, 'cart_0001')
})

test('invalid_request: a bad input fails its schema', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  assert.equal((await rejection(acme.products.list({ limit: 51 }))).code, 'invalid_request')
  assert.equal((await rejection(acme.products.list({ limit: 0 }))).code, 'invalid_request')
  assert.equal(
    (await rejection(acme.carts.addItem(cartId, { productId: 'prod_003', quantity: 0 }))).code,
    'invalid_request',
  )
  assert.equal(
    (await rejection(acme.carts.updateItem(cartId, 'prod_003', { quantity: 1.5 }))).code,
    'invalid_request',
  )
  assert.equal(
    (await rejection(acme.orders.create({ cartId, paymentToken: '' }))).code,
    'invalid_request',
  )
  const error = await rejection(acme.orders.list({ status: 'lost' as 'paid' }))
  assert.equal(error.code, 'invalid_request')
  assert.equal(error.status, 400)
  assert.match(error.message, /status/)
})

test('not_found: unknown product, cart, order and cart line', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  const calls = [
    acme.products.get('prod_999'),
    acme.carts.get('cart_9999'),
    acme.carts.addItem('cart_9999', { productId: 'prod_003', quantity: 1 }),
    acme.carts.addItem(cartId, { productId: 'prod_999', quantity: 1 }),
    acme.carts.updateItem(cartId, 'prod_001', { quantity: 1 }),
    acme.carts.removeItem(cartId, 'prod_001'),
    acme.orders.create({ cartId: 'cart_9999', paymentToken: 'tok_ok' }),
    acme.orders.get('order_9999'),
    acme.orders.cancel('order_9999'),
  ]
  for (const call of calls) {
    const error = await rejection(call)
    assert.equal(error.code, 'not_found')
    assert.equal(error.status, 404)
  }
})

test('insufficient_stock: more than the stock, or a product with none', async () => {
  const { acme } = setup()
  for (const [productId, quantity] of [
    ['prod_020', 71],
    ['prod_005', 1],
  ] as const) {
    const cartId = await cartWith(acme, productId, quantity)
    const error = await rejection(acme.orders.create({ cartId, paymentToken: 'tok_ok' }))
    assert.equal(error.code, 'insufficient_stock')
    assert.equal(error.status, 409)
    assert.equal((await acme.carts.get(cartId)).items.length, 1)
  }
})

test('cart_empty: checkout of an empty cart', async () => {
  const { acme } = setup()
  const cart = await acme.carts.create()
  const error = await rejection(acme.orders.create({ cartId: cart.id, paymentToken: 'tok_ok' }))
  assert.equal(error.code, 'cart_empty')
  assert.equal(error.status, 409)
})

test('cart_empty: a cart cannot be checked out twice', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  await acme.orders.create({ cartId, paymentToken: 'tok_ok' })
  const error = await rejection(acme.orders.create({ cartId, paymentToken: 'tok_ok' }))
  assert.equal(error.code, 'cart_empty')
})

test('payment_declined changes nothing', async () => {
  const { acme, store } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const before = await store.read()
  const error = await rejection(acme.orders.create({ cartId, paymentToken: 'tok_declined' }))
  assert.equal(error.code, 'payment_declined')
  assert.equal(error.status, 402)
  assert.deepEqual(await store.read(), before)
})

test('coupon_invalid: unknown, expired and below the minimum spend', async () => {
  const { acme } = setup()
  const big = await cartWith(acme, 'prod_003', 2)
  const small = await cartWith(acme, 'prod_011', 1)
  for (const [cartId, couponCode] of [
    [big, 'NOPE'],
    [big, 'EXPIRED20'],
    [small, 'SAVE5'],
  ] as const) {
    const error = await rejection(
      acme.orders.create({ cartId, paymentToken: 'tok_ok', couponCode }),
    )
    assert.equal(error.code, 'coupon_invalid')
    assert.equal(error.status, 422)
  }
  assert.equal((await acme.products.get('prod_003')).stock, 30)
})

test('order_not_cancelable: a shipped or canceled order', async () => {
  const { acme } = setup()
  const error = await rejection(acme.orders.cancel('order_0002'))
  assert.equal(error.code, 'order_not_cancelable')
  assert.equal(error.status, 409)
  await acme.orders.cancel('order_0001')
  assert.equal((await rejection(acme.orders.cancel('order_0001'))).code, 'order_not_cancelable')
})

test('the same calls give the same results', async () => {
  const run = async () => {
    const { acme } = setup()
    const cartId = await cartWith(acme, 'prod_003', 2)
    return acme.orders.create({ cartId, paymentToken: 'tok_ok', couponCode: 'WELCOME10' })
  }
  assert.deepEqual(await run(), await run())
})

test('carts.addItem refuses to take a line past the largest quantity', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 99)
  const error = await rejection(acme.carts.addItem(cartId, { productId: 'prod_003', quantity: 1 }))
  assert.equal(error.code, 'invalid_request')
  assert.equal((await acme.carts.get(cartId)).items[0]?.quantity, 99)
})

test('not_found: ids that name an Object.prototype member', async () => {
  const { acme } = setup()
  for (const id of ['__proto__', 'constructor', 'toString']) {
    const calls = [
      () => acme.products.get(id),
      () => acme.carts.get(id),
      () => acme.carts.addItem(id, { productId: 'prod_003', quantity: 1 }),
      () => acme.carts.updateItem(id, 'prod_003', { quantity: 1 }),
      () => acme.carts.removeItem(id, 'prod_003'),
      () => acme.orders.create({ cartId: id, paymentToken: 'tok_ok' }),
      () => acme.orders.get(id),
      () => acme.orders.cancel(id),
    ]
    for (const call of calls) assert.equal((await rejection(call())).code, 'not_found', id)
  }
})

test('orders.create replays an idempotencyKey that names an Object.prototype member', async () => {
  const { acme } = setup()
  for (const idempotencyKey of ['__proto__', 'constructor']) {
    const input = {
      cartId: await cartWith(acme, 'prod_003', 1),
      paymentToken: 'tok_ok',
      idempotencyKey,
    }
    const first = await acme.orders.create(input)
    assert.deepEqual(await acme.orders.create(input), first)
  }
  assert.equal((await acme.orders.list()).data.length, 4)
})

test('products.list pages at the boundaries', async () => {
  const { acme } = setup()
  const all = await acme.products.list({ limit: 50 })
  assert.equal(all.data.length, 24)
  assert.equal(all.nextCursor, null)
  const exact = await acme.products.list({ limit: 12, cursor: 'prod_012' })
  assert.deepEqual([exact.data[0]?.id, exact.data.length, exact.nextCursor], ['prod_013', 12, null])
  const one = await acme.products.list({ limit: 1, cursor: 'prod_023' })
  assert.deepEqual([one.data.map((product) => product.id), one.nextCursor], [['prod_024'], null])
  assert.deepEqual(await acme.products.list({ cursor: 'prod_024' }), { data: [], nextCursor: null })
})

test('products.list filters by q on the description, and by category and q together', async () => {
  const { acme } = setup()
  const byDescription = await acme.products.list({ q: 'charging case' })
  assert.deepEqual(
    byDescription.data.map((product) => product.id),
    ['prod_002'],
  )
  const both = await acme.products.list({ category: 'computing', q: 'usb' })
  assert.deepEqual(
    both.data.map((product) => product.id),
    ['prod_009', 'prod_010'],
  )
})

test('invalid_request: a category outside the seed categories lists the valid ones', async () => {
  const { acme } = setup()
  for (const category of ['Audio', 'toys', '']) {
    const error = await rejection(acme.products.list({ category: category as 'audio' }))
    assert.equal(error.code, 'invalid_request')
    assert.equal(
      error.message,
      'category: Invalid option: expected one of "audio"|"computing"|"home"|"outdoors"',
    )
  }
})

test('invalid_request: an unknown field names the field', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  const products = { q: 'lamp', query: 'lamp' }
  const item = { productId: 'prod_003', quantity: 1, qty: 2 }
  const update = { quantity: 2, note: 'gift' }
  const order = { cartId, paymentToken: 'tok_ok', coupon: 'WELCOME10' }
  const orders = { status: 'paid' as const, sort: 'desc' }
  const calls: [Promise<unknown>, string][] = [
    [acme.products.list(products), 'query'],
    [acme.carts.addItem(cartId, item), 'qty'],
    [acme.carts.updateItem(cartId, 'prod_003', update), 'note'],
    [acme.orders.create(order), 'coupon'],
    [acme.orders.list(orders), 'sort'],
  ]
  for (const [call, field] of calls) {
    const error = await rejection(call)
    assert.equal(error.code, 'invalid_request', field)
    assert.equal(error.message, `Unrecognized key: "${field}"`)
  }
  assert.equal((await acme.carts.get(cartId)).items[0]?.quantity, 1)
})

test('invalid_request: a cursor that is not the id of a product in the list', async () => {
  const { acme } = setup()
  for (const [input, cursor] of [
    [{}, 'prod_999'],
    [{}, ''],
    [{}, 'prod_1'],
    [{ category: 'audio' as const }, 'prod_010'],
    [{ q: 'lamp' }, 'prod_001'],
  ] as const) {
    const error = await rejection(acme.products.list({ ...input, cursor }))
    assert.equal(error.code, 'invalid_request', cursor)
    assert.equal(
      error.message,
      `cursor: "${cursor}" is not the id of a product in this list. Pass the nextCursor of the previous page, or no cursor for the first page`,
    )
  }
})

test('invalid_request: a cursor that is not the id of an order', async () => {
  const { acme } = setup()
  for (const input of [{}, { status: 'paid' as const }]) {
    const error = await rejection(acme.orders.list({ ...input, cursor: 'order_9999' }))
    assert.equal(error.code, 'invalid_request')
    assert.equal(
      error.message,
      'cursor: "order_9999" is not the id of an order. Pass the nextCursor of the previous page, or no cursor for the first page',
    )
  }
})

test('orders.list with a status takes the id of an order of any status as its cursor', async () => {
  const { acme } = setup()
  const shipped = await acme.orders.list({ status: 'shipped', cursor: 'order_0001' })
  assert.deepEqual(
    shipped.data.map((order) => order.id),
    ['order_0002'],
  )
  const paid = await acme.orders.list({ status: 'paid', cursor: 'order_0002' })
  assert.deepEqual(paid, { data: [], nextCursor: null })
})

test('orders.list pages on when the order of the cursor changes status between pages', async () => {
  const { acme } = setup()
  await acme.orders.create({ cartId: await cartWith(acme, 'prod_003', 1), paymentToken: 'tok_ok' })
  const first = await acme.orders.list({ status: 'paid', limit: 1 })
  assert.deepEqual(
    [first.data.map((order) => order.id), first.nextCursor],
    [['order_0001'], 'order_0001'],
  )
  await acme.orders.cancel('order_0001')
  const second = await acme.orders.list({
    status: 'paid',
    limit: 1,
    cursor: first.nextCursor ?? undefined,
  })
  assert.deepEqual(
    [second.data.map((order) => order.id), second.nextCursor],
    [['order_0003'], null],
  )
})

test('invalid_request: a free string over 255 characters', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  const long = 'x'.repeat(256)
  const tooBig = 'Too big: expected string to have <=255 characters'
  const calls: [Promise<unknown>, string][] = [
    [acme.products.list({ q: long }), 'q'],
    [acme.products.list({ cursor: long }), 'cursor'],
    [acme.orders.list({ cursor: long }), 'cursor'],
    [acme.products.get(long), 'productId'],
    [acme.carts.get(long), 'cartId'],
    [acme.carts.addItem(long, { productId: 'prod_003', quantity: 1 }), 'cartId'],
    [acme.carts.addItem(cartId, { productId: long, quantity: 1 }), 'productId'],
    [acme.carts.updateItem(long, 'prod_003', { quantity: 1 }), 'cartId'],
    [acme.carts.updateItem(cartId, long, { quantity: 1 }), 'productId'],
    [acme.carts.removeItem(long, 'prod_003'), 'cartId'],
    [acme.carts.removeItem(cartId, long), 'productId'],
    [acme.orders.create({ cartId: long, paymentToken: 'tok_ok' }), 'cartId'],
    [acme.orders.create({ cartId, paymentToken: long }), 'paymentToken'],
    [acme.orders.create({ cartId, paymentToken: 'tok_ok', couponCode: long }), 'couponCode'],
    [acme.orders.get(long), 'orderId'],
    [acme.orders.cancel(long), 'orderId'],
  ]
  for (const [call, field] of calls) {
    const error = await rejection(call)
    assert.equal(error.code, 'invalid_request', field)
    assert.equal(error.message, `${field}: ${tooBig}`)
  }
  assert.deepEqual(await acme.products.list({ q: 'x'.repeat(255) }), {
    data: [],
    nextCursor: null,
  })
  assert.equal((await rejection(acme.products.get('x'.repeat(255)))).code, 'not_found')
  assert.equal(
    (await rejection(acme.orders.get(''))).message,
    'orderId: Too small: expected string to have >=1 characters',
  )
})

test('createServices requires a clock', () => {
  // @ts-expect-error the clock is required
  assert.throws(() => createServices(createMemoryStore()), {
    name: 'TypeError',
    message: 'createServices needs a clock, such as () => new Date()',
  })
})

test('a returned value is a copy of the stored state', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  const [line] = (await acme.carts.get(cartId)).items
  assert.ok(line)
  line.quantity = 50
  const order = await acme.orders.get('order_0001')
  order.status = 'canceled'
  assert.equal((await acme.carts.get(cartId)).items[0]?.quantity, 2)
  assert.equal((await acme.orders.get('order_0001')).status, 'paid')
})

test('orders.create replays an idempotencyKey with different input as the first order', async () => {
  const { acme, store } = setup()
  const first = await acme.orders.create({
    cartId: await cartWith(acme, 'prod_003', 1),
    paymentToken: 'tok_ok',
    idempotencyKey: 'k',
  })
  const otherCart = await cartWith(acme, 'prod_008', 3)
  const before = await store.read()
  const again = await acme.orders.create({
    cartId: otherCart,
    paymentToken: 'tok_declined',
    couponCode: 'NOPE',
    idempotencyKey: 'k',
  })
  assert.deepEqual(again, first)
  assert.deepEqual(await store.read(), before)
})

test('orders.create records no idempotencyKey for a failed checkout', async () => {
  const { acme } = setup()
  const cartId = await cartWith(acme, 'prod_003', 1)
  const input = { cartId, idempotencyKey: 'k' }
  await rejection(acme.orders.create({ ...input, paymentToken: 'tok_declined' }))
  const order = await acme.orders.create({ ...input, paymentToken: 'tok_ok' })
  assert.equal(order.id, 'order_0003')
})

test('orders.create checks every line before it takes any stock', async () => {
  const { acme, store } = setup()
  const cartId = await cartWith(acme, 'prod_003', 2)
  await acme.carts.addItem(cartId, { productId: 'prod_010', quantity: 9 })
  const before = await store.read()
  const error = await rejection(acme.orders.create({ cartId, paymentToken: 'tok_ok' }))
  assert.equal(error.code, 'insufficient_stock')
  assert.deepEqual(await store.read(), before)
})

test('orders.create checks coupon expiry against the injected clock', async () => {
  const at = async (time: string) => {
    const acme = createServices(createMemoryStore(), () => new Date(time))
    const cartId = await cartWith(acme, 'prod_003', 1)
    return acme.orders.create({ cartId, paymentToken: 'tok_ok', couponCode: 'EXPIRED20' })
  }
  assert.equal((await at('2019-12-31T23:59:59.999Z')).discountCents, 1180)
  assert.equal((await rejection(at('2020-01-01T00:00:00.000Z'))).code, 'coupon_invalid')
})

test('orders.cancel returns the stock of every line', async () => {
  const { acme } = setup()
  await acme.orders.cancel('order_0001')
  assert.equal((await acme.products.get('prod_001')).stock, 26)
  assert.equal((await acme.products.get('prod_008')).stock, 52)
  assert.equal((await acme.products.get('prod_013')).stock, 35)
})
